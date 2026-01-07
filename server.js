
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

// Rota: Listar Produtos
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

        // QUERY ATUALIZADA: Colunas específicas, Estoque Atual e Filtro Ativo
        let sql = `
            SELECT FIRST ? SKIP ? 
                P.PRO_COD, 
                P.PRO_DESCRI, 
                P.PRO_NRFABRICANTE, 
                P.PRO_EST_ATUAL,
                P.PRO_COD_SIMILAR,
                P.GR_COD,
                P.SG_COD,
                P.MAR_COD
            FROM PRODUTOS P 
            WHERE P.PRO_ATIVO = 'S'
        `;

        const params = [limit, skip];

        if (search) {
            sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`;
            params.push(search);
            params.push(search);
        }

        db.query(sql, params, (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });

            // Mapeamento atualizado conforme solicitado
            const mapped = result.map(item => {
                // Tratamento básico para strings que podem vir como buffer no node-firebird
                const nome = item.PRO_DESCRI ? item.PRO_DESCRI.toString() : '';
                const sku = item.PRO_NRFABRICANTE ? item.PRO_NRFABRICANTE.toString().trim() : '';
                const similarId = item.PRO_COD_SIMILAR ? item.PRO_COD_SIMILAR.toString().trim() : null;

                return {
                    id: item.PRO_COD,
                    name: nome,
                    sku: sku,
                    balance: parseFloat(item.PRO_EST_ATUAL || 0), // Saldo vindo de PRO_EST_ATUAL
                    similar_id: similarId,
                    brand: 'GENÉRICO', // Ajuste se houver tabela de MARCAS para fazer join
                    location: 'ESTOQUE GERAL', // Ajuste se houver campo de localização específico
                    status: 'active'
                };
            });

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

        const sql = `
            SELECT FIRST 200
                ID, SKU, NOME_PRODUTO, USUARIO_NOME, QTD_CONTADA, LOCALIZACAO, STATUS, DATA_HORA
            FROM GRIDE_INVENTARIO_LOG
            ORDER BY DATA_HORA DESC
        `;

        db.query(sql, [], (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });
            
            const safeResult = result.map(r => {
                return {
                    ...r,
                    NOME_PRODUTO: r.NOME_PRODUTO ? r.NOME_PRODUTO.toString() : '',
                    USUARIO_NOME: r.USUARIO_NOME ? r.USUARIO_NOME.toString() : '',
                    STATUS: r.STATUS ? r.STATUS.toString() : '',
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
