
// 11. Histórico (Alias para manter contrato com front)
app.get('/history', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 300; 
    const skip = (page - 1) * limit;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        const sql = `
            SELECT FIRST ? SKIP ? 
            L.ID, L.BLOCK_REF, L.DATA_HORA, L.USUARIO_NOME, L.QTD_CONTADA, L.LOCALIZACAO, 
            L.PRO_NRFABRICANTE as SKU, 
            L.NOME_PRODUTO,
            L.STATUS, 
            T.STATUS as TRATAMENTO_STATUS, 
            P.PRO_COD_SIMILAR, P.PRO_DESCRI as PROD_DESC_ATUAL, 
            M.MAR_DESCRI as MARCA_NOME 
            FROM GRIDE_INVENTARIO_LOG L 
            LEFT JOIN GRIDE_TRATAMENTO T ON T.LOG_ID = L.ID 
            LEFT JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD 
            LEFT JOIN MARCAS M ON M.MAR_COD = P.MAR_COD
            ORDER BY L.DATA_HORA DESC
        `;
        db.query(sql, [limit, skip], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            // Mapeia status PT -> EN para o frontend
            const mapped = result.map(r => ({
                ...r,
                STATUS: FROM_DB_STATUS[safeString(r.STATUS)] || 'completed' // fallback
            }));
            res.json(mapped);
        });
    });
});
