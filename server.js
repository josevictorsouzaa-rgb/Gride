
const express = require('express');
const Firebird = require('node-firebird');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuração do Firebird
const options = {
    host: '127.0.0.1',
    port: 3050,
    database: 'C:\\Users\\DELL G15\\Desktop\\BD\\DATABASE\\DATABASE.FDB',
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false, // Retorna colunas em MAIÚSCULO conforme padrão FB
    role: null,
    pageSize: 4096
};

// Rota: Listar Produtos (Substitui get_produtos.php)
app.get('/products', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao conectar no banco' });
        }

        let sql = `
            SELECT FIRST ? SKIP ? 
                P.PRO_COD as ID, 
                P.PRO_DESCRI as NOME, 
                P.PRO_REFERENCIA as SKU, 
                P.PRO_MARCA as MARCA, 
                P.PRO_SALDO as SALDO,
                P.PRO_LOCALIZACAO as LOCAL
            FROM PRODUTOS P 
            WHERE 1=1
        `;

        const params = [limit, skip];

        if (search) {
            sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_REFERENCIA CONTAINING ?)`;
            params.push(search);
            params.push(search);
        }

        db.query(sql, params, (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });

            // Mapeamento para o formato do Frontend
            const mapped = result.map(item => ({
                id: item.ID,
                name: item.NOME,
                sku: item.SKU ? item.SKU.toString().trim() : '',
                brand: item.MARCA,
                balance: parseFloat(item.SALDO),
                location: item.LOCAL,
                status: parseFloat(item.SALDO) > 0 ? 'active' : 'inactive'
            }));

            res.json(mapped);
        });
    });
});

// Rota: Salvar Contagem (Lastro)
app.post('/save-count', (req, res) => {
    const { sku, nome_produto, usuario_id, usuario_nome, qtd_sistema, qtd_contada, localizacao, status, divergencia_motivo } = req.body;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro ao conectar no banco' });

        const sql = `
            INSERT INTO GRIDE_INVENTARIO_LOG 
            (SKU, NOME_PRODUTO, USUARIO_ID, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, DATA_HORA)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const params = [
            sku, 
            nome_produto, 
            usuario_id, 
            usuario_nome, 
            qtd_sistema, 
            qtd_contada, 
            localizacao, 
            status,
            divergencia_motivo || ''
        ];

        db.query(sql, params, (err, result) => {
            db.detach();
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erro ao salvar histórico' });
            }
            res.json({ success: true, message: 'Contagem registrada com sucesso' });
        });
    });
});

// Rota: Obter Histórico
app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro ao conectar no banco' });

        // Traz os últimos 200 registros ordenados por data
        const sql = `
            SELECT FIRST 200
                ID, SKU, NOME_PRODUTO, USUARIO_NOME, QTD_CONTADA, LOCALIZACAO, STATUS, DATA_HORA
            FROM GRIDE_INVENTARIO_LOG
            ORDER BY DATA_HORA DESC
        `;

        db.query(sql, [], (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });
            
            // Converter BLOBs ou Buffers se necessário (dependendo do driver, strings podem vir como buffer)
            const safeResult = result.map(r => {
                return {
                    ...r,
                    NOME_PRODUTO: r.NOME_PRODUTO.toString(),
                    USUARIO_NOME: r.USUARIO_NOME.toString(),
                    STATUS: r.STATUS.toString(),
                    LOCALIZACAO: r.LOCALIZACAO ? r.LOCALIZACAO.toString() : 'N/A'
                }
            });

            res.json(safeResult);
        });
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor Node Firebird rodando em http://localhost:${port}`);
});
