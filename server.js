
app.get('/analytics/financial-items', (req, res) => {
    const { gr_cod, sg_cod } = req.query;
    if (!gr_cod || !sg_cod) return res.json([]);

    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        const sql = `
            SELECT FIRST 200
                P.PRO_NRFABRICANTE,
                P.PRO_DESCRI,
                P.PRO_EST_ATUAL,
                P.PRO_PRECOULTCOMPRA,
                (P.PRO_EST_ATUAL * COALESCE(P.PRO_PRECOULTCOMPRA, 0)) as VALOR_TOTAL
            FROM PRODUTOS P
            WHERE P.GR_COD = ? AND P.SG_COD = ? AND P.PRO_ATIVO = 'S'
            ORDER BY 5 DESC
        `;
        db.query(sql, [gr_cod, sg_cod], (err, rows) => {
            db.detach();
            if (err) return res.json([]);
            const items = rows.map(r => ({
                sku: safeString(r.PRO_NRFABRICANTE),
                name: safeString(r.PRO_DESCRI),
                qty: r.PRO_EST_ATUAL,
                unitPrice: r.PRO_PRECOULTCOMPRA || 0, // Adicionado
                value: r.VALOR_TOTAL || 0
            }));
            res.json(items);
        });
    });
});
