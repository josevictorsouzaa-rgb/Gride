
import express from 'express';
import Firebird from 'node-firebird';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const port = 8000;

// Configuração do Banco de Dados
const DB_PATH = 'C:\\Users\\DELL G15\\Desktop\\BD\\DATABASE\\DATABASE.FDB';

// Parâmetros Globais da Meta (Padrões, atualizados via rota)
const GLOBAL_SETTINGS = {
    dailyTarget: 150,
    cooldownDays: 30,
    highGiroThreshold: 5,
    accumulationMode: true,
    highGiroSplit: 40 // Nova propriedade: % destinada ao Giro Alto (Padrão 40%)
};

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Configuração do Firebird
const options = {
    host: '127.0.0.1',
    port: 3050,
    database: DB_PATH,
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false, 
    role: null,
    pageSize: 4096
};

// --- MAPAS DE TRADUÇÃO DE STATUS (FRONTEND <-> BANCO) ---
const TO_DB_STATUS = {
    'pending': 'Pendente',
    'progress': 'Em Andamento',
    'counted': 'Contado',
    'not_located': 'Não Localizado',
    'issue': 'Divergência',
    'divergence_info': 'Divergência',
    'completed': 'Concluído',
    'reserved': 'RESERVADO',
    'released': 'DEVOLVIDO',
    'edited': 'EDIÇÃO'
};

const FROM_DB_STATUS = {
    'Pendente': 'pending',
    'Em Andamento': 'progress',
    'Contado': 'counted',
    'Não Localizado': 'not_located',
    'Divergência': 'divergence_info',
    'Concluído': 'completed',
    'RESERVADO': 'reserved',
    'DEVOLVIDO': 'released',
    'EDIÇÃO': 'edited'
};

// --- HELPER DE QUERY PROMISIFIED ---
const execute = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

// --- HELPER PARA IGNORAR ERROS DE "JÁ EXISTE" ---
const safeExecute = async (db, sql, description) => {
    try {
        console.log(`Executing: ${description}`);
        await execute(db, sql);
        console.log(`   [OK] ${description}`);
    } catch (e) {
        const msg = e.message.toLowerCase();
        if (msg.includes('exists') || msg.includes('unsuccessful metadata update') || msg.includes('already')) {
            // console.log(`   [SKIP] ${description} (Já existe)`);
        } else {
            console.error(`   [ERRO] ${description}:`, e.message);
        }
    }
};

const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && Buffer.isBuffer(value)) return value.toString().trim();
    return String(value).trim();
};

const blobToString = (blob) => {
    if (blob === null || blob === undefined) return null;
    if (Buffer.isBuffer(blob)) return blob.toString('utf8');
    if (typeof blob === 'string') return blob;
    return String(blob);
};

// --- INIT DB ---
const initDb = () => {
    return new Promise((resolve, reject) => {
        console.log(">>> [INIT] Conectando ao Firebird...");
        Firebird.attach(options, async (err, db) => {
            if (err) {
                console.error(">>> [FATAL] Não foi possível conectar ao DB:", err.message);
                return resolve(); 
            }
            try {
                // Tabelas Existentes
                await safeExecute(db, `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, "Tabela Endereços");
                await safeExecute(db, `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, "Tabela Galpões");
                await safeExecute(db, `CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USU_COD VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), PRO_COD INTEGER, RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Reservas");
                await safeExecute(db, `ALTER TABLE GRIDE_RESERVAS ADD ITEMS_JSON BLOB SUB_TYPE TEXT`, "Coluna ITEMS_JSON em Reservas");
                await safeExecute(db, `CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), USU_COD VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(50), DIVERGENCIA_MOTIVO VARCHAR