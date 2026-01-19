
app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Conexão' });
        
        // 1. Obter mapa de Reservas Ativas
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockMap = new Map();
            if(reservations) reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), r.USER_NAME));

            // 2. Obter mapa de Itens já contados
            db.query("SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')", [], (errL, logs) => {
                const countedSet = new Set();
                if(logs) logs.forEach(l => countedSet.add(l.PRO_COD));

                // --- ETAPA 1: DESCOBERTA (Encontrar quais blocos exibir) ---
                // Buscamos mais registros (limit * 5) para garantir que encontraremos 'limit' blocos únicos
                let discoverySql = `
                    SELECT FIRST ? 
                    P.PRO_COD, P.PRO_COD_SIMILAR 
                    FROM PRODUTOS P 
                    WHERE P.PRO_ATIVO = 'S'
                `;
                
                const discoveryParams = [limit * 5]; 

                if (search) { 
                    discoverySql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; 
                    discoveryParams.push(search); discoveryParams.push(search); 
                }
                if (gr_cod) { discoverySql += ` AND TRIM(P.GR_COD) = ?`; discoveryParams.push(gr_cod); }
                if (sg_cod) { discoverySql += ` AND TRIM(P.SG_COD) = ?`; discoveryParams.push(sg_cod); }
                if (location) { discoverySql += ` AND P.PRO_PRATELEIRA STARTING WITH ?`; discoveryParams.push(location); }

                discoverySql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                db.query(discoverySql, discoveryParams, (errD, discoveryRows) => {
                    if (errD) { db.detach(); return res.status(500).json({ error: errD.message }); }

                    // Processar linhas para encontrar as chaves únicas dos blocos (Similar ou ID)
                    const targetSimilars = new Set();
                    const targetSingles = new Set();
                    const seenKeys = new Set();
                    let blocksFound = 0;

                    for (const row of discoveryRows) {
                        if (blocksFound >= limit) break;

                        const sim = row.PRO_COD_SIMILAR ? safeString(row.PRO_COD_SIMILAR) : null;
                        const id = safeString(row.PRO_COD);
                        
                        // A chave do bloco é o Similar (se existir) ou o próprio ID
                        const key = sim || id;

                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            if (sim) targetSimilars.add(sim);
                            else targetSingles.add(id);
                            blocksFound++;
                        }
                    }

                    if (targetSimilars.size === 0 && targetSingles.size === 0) {
                        db.detach();
                        return res.json([]);
                    }

                    // --- ETAPA 2: ENRIQUECIMENTO (Buscar TODOS os itens dos blocos identificados) ---
                    // Agora buscamos a família completa de cada chave identificada
                    let fetchSql = `
                        SELECT 
                        P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, 
                        M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA 
                        FROM PRODUTOS P 
                        LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) 
                        WHERE P.PRO_ATIVO = 'S' AND (
                    `;

                    const fetchParams = [];
                    const criteria = [];

                    // Adiciona critério para Similares
                    if (targetSimilars.size > 0) {
                        const placeholders = Array.from(targetSimilars).map(() => '?').join(',');
                        criteria.push(`P.PRO_COD_SIMILAR IN (${placeholders})`);
                        fetchParams.push(...targetSimilars);
                    }

                    // Adiciona critério para Itens Únicos
                    if (targetSingles.size > 0) {
                        const placeholders = Array.from(targetSingles).map(() => '?').join(',');
                        criteria.push(`P.PRO_COD IN (${placeholders})`);
                        fetchParams.push(...targetSingles);
                    }

                    fetchSql += criteria.join(' OR ') + `)`;
                    
                    // Mantemos a ordenação para visualização consistente
                    fetchSql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                    db.query(fetchSql, fetchParams, (errP, products) => {
                        db.detach();
                        if (errP) return res.status(500).json({ error: errP.message });

                        // Agrupamento (Lógica existente mantida, agora com dados completos)
                        const groups = new Map();
                        products.forEach(p => {
                            const key = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                            const isCounted = countedSet.has(p.PRO_COD);
                            
                            if (!groups.has(key)) groups.set(key, []);
                            groups.get(key).push({
                                id: safeString(p.PRO_COD),
                                name: safeString(p.PRO_DESCRI),
                                ref: safeString(p.PRO_NRFABRICANTE),
                                brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'GENÉRICO',
                                balance: parseFloat(p.PRO_EST_ATUAL || 0),
                                location: safeString(p.PRO_PRATELEIRA) || 'GERAL',
                                isCounted: isCounted
                            });
                        });

                        const blocks = [];
                        groups.forEach((items, key) => {
                            const lockedBy = lockMap.get(key);
                            const allCounted = items.every(i => i.isCounted);
                            let status = allCounted ? 'completed' : 'pending';
                            if (lockedBy) status = 'progress';

                            blocks.push({
                                id: key,
                                parentRef: items[0].ref || items[0].name,
                                location: items[0].location,
                                status: status,
                                items: items,
                                lockedBy: lockedBy ? { userName: lockedBy } : null
                            });
                        });

                        // Ordenar: Pendentes primeiro
                        blocks.sort((a, b) => {
                            if (a.status === 'pending' && b.status !== 'pending') return -1;
                            if (a.status !== 'pending' && b.status === 'pending') return 1;
                            return 0;
                        });

                        // Retornamos tudo que encontramos na Etapa 2 (que correspondem ao 'limit' da Etapa 1)
                        res.json(blocks);
                    });
                });
            });
        });
    });
});
