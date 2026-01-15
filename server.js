
// ... (código anterior mantido até a rota /daily-meta-suggestions)

            // 4. FILA 2: CICLO
            const neededForCycle = effectiveTarget - highGiroIds.length;
            const skipIds = [...highGiroIds, ...(excludedIds ? excludedIds.split(',') : [])].filter(x => x).join(',');
            const skipClause = skipIds ? `AND P.PRO_COD NOT IN (${skipIds})` : '';

            // CIRURGICO: Uso explícito do neededForCycle sem limites inferiores
            const sqlCycle = `
                SELECT FIRST ${neededForCycle} P.PRO_COD
                FROM PRODUTOS P
                LEFT JOIN GRIDE_INVENTARIO_LOG L ON L.PRO_COD = P.PRO_COD
                WHERE P.PRO_ATIVO = 'S'
                ${skipClause}
                GROUP BY P.PRO_COD
                ORDER BY MAX(L.DATA_HORA) ASC NULLS FIRST
            `;
            
            const cycleResult = await execute(db, sqlCycle);
            const cycleIds = cycleResult.map(r => r.PRO_COD);

            const finalIds = [...highGiroIds, ...cycleIds];
            
            if (finalIds.length === 0) {
                db.detach();
                return res.json([]);
            }

            // 5. Busca detalhes (ALTERADO PARA TRAZER O BLOCO COMPLETO)
            const finalIdsStr = finalIds.join(',');
            
            // Query ajustada para trazer todos os itens relacionados por PRO_COD_SIMILAR
            const sqlDetails = `
                SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA
                FROM PRODUTOS P 
                LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD)
                WHERE P.PRO_COD IN (${finalIdsStr}) 
                   OR P.PRO_COD_SIMILAR IN (SELECT DISTINCT PRO_COD_SIMILAR FROM PRODUTOS WHERE PRO_COD IN (${finalIdsStr}) AND PRO_COD_SIMILAR IS NOT NULL AND PRO_COD_SIMILAR <> '')
                   OR P.PRO_COD IN (SELECT DISTINCT PRO_COD_SIMILAR FROM PRODUTOS WHERE PRO_COD IN (${finalIdsStr}) AND PRO_COD_SIMILAR IS NOT NULL AND PRO_COD_SIMILAR <> '')
                ORDER BY P.PRO_PRATELEIRA
            `;

            const products = await execute(db, sqlDetails);
            db.detach();

            // 6. Formata (CORRIGIDO: P.PRO_PRATELEIRA)
            const groups = new Map();
            const todayFormatted = new Date().toLocaleDateString('pt-BR');

// ... (restante do código mantido)
