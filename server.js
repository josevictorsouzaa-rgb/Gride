
            const exclusionSql = `SELECT PRO_COD FROM GRIDE_RESERVAS UNION SELECT PRO_COD FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'`;
            const exclusions = await execute(db, exclusionSql);
            const excludedIds = exclusions.map(r => r.PRO_COD).filter(id => id).join(',');
            const exclusionClause = excludedIds ? `AND P.PRO_COD NOT IN (${excludedIds})` : '';

            // 1. FILA 1: GIRO ALTO (Baseado em Grupos/Blocos)
            // Se UM item do grupo tem alto giro e está vencido, trazemos o ID do grupo (PRO_COD_SIMILAR)
            let highGiroSimilars = [];
            try {
                const sqlGiro = `
                    SELECT FIRST ${Math.floor(effectiveTarget * 0.4)} DISTINCT P.PRO_COD_SIMILAR
                    FROM PRODUTOS P
                    WHERE P.PRO_COD IN (
                        SELECT PI.PRO_COD
                        FROM PEDIDOSITENS PI
                        LEFT JOIN GRIDE_INVENTARIO_LOG L ON L.PRO_COD = PI.PRO_COD
                        WHERE PI.DATA >= DATEADD(-30 DAY TO CURRENT_DATE)
                        ${exclusionClause}
                        GROUP BY PI.PRO_COD
                        HAVING COUNT(*) >= ${highGiroThreshold}
                        AND (MAX(L.DATA_HORA) IS NULL OR MAX(L.DATA_HORA) < DATEADD(-${cooldownDays} DAY TO CURRENT_DATE))
                    )
                    AND P.PRO_COD_SIMILAR IS NOT NULL AND P.PRO_COD_SIMILAR <> ''
                `;
                const giroResult = await execute(db, sqlGiro);
                highGiroSimilars = giroResult.map(r => safeString(r.PRO_COD_SIMILAR).trim()).filter(id => id);
            } catch (e) { console.warn("Pulando Giro.", e.message); }

            // 2. FILA 2: CICLO (Baseado em Grupos/Blocos)
            // Traz grupos onde o item "mais velho" (menor data de contagem) dita a prioridade
            const neededForCycle = effectiveTarget - highGiroSimilars.length;
            
            // Prepara exclusão dos grupos já selecionados no Giro
            const skipSimilarsStr = highGiroSimilars.map(s => `'${s}'`).join(',');
            const skipClause = skipSimilarsStr ? `AND P.PRO_COD_SIMILAR NOT IN (${skipSimilarsStr})` : '';

            const sqlCycle = `
                SELECT FIRST ${neededForCycle} P.PRO_COD_SIMILAR
                FROM PRODUTOS P
                LEFT JOIN GRIDE_INVENTARIO_LOG L ON L.PRO_COD = P.PRO_COD
                WHERE P.PRO_ATIVO = 'S'
                ${exclusionClause}
                ${skipClause}
                AND P.PRO_COD_SIMILAR IS NOT NULL AND P.PRO_COD_SIMILAR <> ''
                GROUP BY P.PRO_COD_SIMILAR
                ORDER BY MIN(L.DATA_HORA) ASC NULLS FIRST
            `;
            
            const cycleResult = await execute(db, sqlCycle);
            const cycleSimilars = cycleResult.map(r => safeString(r.PRO_COD_SIMILAR).trim()).filter(id => id);

            const finalSimilars = [...highGiroSimilars, ...cycleSimilars];
            
            if (finalSimilars.length === 0) {
                db.detach();
                return res.json([]);
            }

            // 3. BUSCA DETALHES (Traz todos os itens pertencentes aos blocos sorteados)
            const finalIdsStr = finalSimilars.map(s => `'${s}'`).join(',');
            
            const sqlDetails = `
                SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA
                FROM PRODUTOS P 
                LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD)
                WHERE P.PRO_COD_SIMILAR IN (${finalIdsStr})
                ORDER BY P.PRO_PRATELEIRA
            `;

            const products = await execute(db, sqlDetails);
            db.detach();

            const groups = new Map();
            const todayFormatted = new Date().toLocaleDateString('pt-BR');

            products.forEach(p => {
                const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR).trim() : safeString(p.PRO_COD).trim();
                const sku = safeString(p.PRO_NRFABRICANTE).trim();
                if (!groups.has(similarId)) groups.set(similarId, []);
                
                groups.get(similarId).push({
                    id: safeString(p.PRO_COD).trim(), db_pro_cod: p.PRO_COD, name: safeString(p.PRO_DESCRI), ref: sku, 
                    brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'SEM MARCA', balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                    location: safeString(p.PRO_PRATELEIRA) || 'GERAL', inTreatment: false 
                });
            });

            const blocks = [];
            groups.forEach((items, key) => {
                const isGiro = highGiroSimilars.includes(key);
                blocks.push({
                    id: key, parentRef: items[0].ref || items[0].name, location: items[0].location, status: 'pending', 
                    date: todayFormatted, subcategory: isGiro ? 'Giro Alto' : 'Ciclo', items: items,
                    // AddedAt: Data de hoje, pois é uma sugestão fresca
                    addedAt: new Date().toISOString()
                });
            });
            res.json(blocks);
