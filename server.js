
// 5. Blocos (Listagem Principal)
app.get('/blocks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod && !isNaN(parseInt(req.query.gr_cod)) ? parseInt(req.query.gr_cod) : null;
    const sg_cod = req.query.sg_cod && !isNaN(parseInt(req.query.sg_cod)) ? parseInt(req.query.sg_cod) : null;
    const location = req.query.location || '';
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro Conexão' });
        
        // Buscar Reservas usando a nova estrutura (USU_COD, PRO_COD no BLOCK_ID)
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (errRes, reservations) => {
            const lockMap = new Map();
            if (!errRes && reservations) {
                reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), { 
                    userId: safeString(r.USU_COD), // Mapeia USU_COD -> userId
                    userName: safeString(r.USER_NAME), 
                    timestamp: r.RESERVED_AT 
                }));
            }

            // Buscar Tratamento usando PRO_NRFABRICANTE (SKU)
            db.query("SELECT PRO_NRFABRICANTE FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (errTreat, treatments) => {
                const treatmentSet = new Set();
                if (!errTreat && treatments) treatments.forEach(t => treatmentSet.add(safeString(t.PRO_NRFABRICANTE)));

                // Query Principal em PRODUTOS com JOIN em MARCAS
                let sql = `
                    SELECT FIRST ? SKIP ? 
                    P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE,
                    M.MAR_DESCRI 
                    FROM PRODUTOS P 
                    LEFT JOIN MARCAS M ON M.MAR_COD = P.MAR_COD
                    WHERE P.PRO_ATIVO = 'S'
                `;
                const params = [limit * 20, skip];

                if (search) { sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; params.push(search); params.push(search); }
                if (gr_cod !== null) { sql += ` AND TRIM(P.GR_COD) = ?`; params.push(gr_cod); }
                if (sg_cod !== null) { sql += ` AND TRIM(P.SG_COD) = ?`; params.push(sg_cod); }
                if (location) { sql += ` AND P.LOCALIZACAO STARTING WITH ?`; params.push(location); }

                sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_COD`;

                db.query(sql, params, (errProd, products) => {
                    db.detach();
                    if (errProd) return res.status(500).json({ error: errProd.message });
                    
                    const groups = new Map();
                    products.forEach(p => {
                        // Lógica de Agrupamento por Similar ou ID
                        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                        const sku = safeString(p.PRO_NRFABRICANTE); // Mapeia PRO_NRFABRICANTE -> sku na lógica interna
                        
                        if (!groups.has(similarId)) groups.set(similarId, []);
                        
                        groups.get(similarId).push({
                            id: safeString(p.PRO_COD), // O 'id' do item é o PRO_COD
                            db_pro_cod: p.PRO_COD, 
                            name: safeString(p.PRO_DESCRI), 
                            ref: sku, // Frontend espera 'ref' ou 'sku'
                            brand: safeString(p.MAR_DESCRI) || 'GENÉRICO', // Usa a descrição da marca
                            balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                            location: 'GERAL', 
                            inTreatment: treatmentSet.has(sku)
                        });
                    });
                    
                    const blocks = [];
                    groups.forEach((items, key) => {
                        const isLocked = lockMap.get(key);
                        blocks.push({
                            id: key, 
                            parentRef: items[0].ref || items[0].name, 
                            location: items[0].location, 
                            status: isLocked ? 'progress' : 'pending', // Status visual (inglês)
                            date: 'Hoje', 
                            items: items, 
                            lockedBy: isLocked
                        });
                    });
                    res.json(blocks.slice(0, limit));
                });
            });
        });
    });
});
