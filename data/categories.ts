// --- ESTRUTURA DO BANCO DE DADOS: TABELA GRUPOS ---
export const DB_CATEGORIES = [
  { GR_COD: 1, GR_DESCRI: 'MOTOR' },
  { GR_COD: 2, GR_DESCRI: 'ALIMENTACAO' },
  { GR_COD: 3, GR_DESCRI: 'REFRIGERACAO' },
  { GR_COD: 4, GR_DESCRI: 'EMBREAGEM' },
  { GR_COD: 5, GR_DESCRI: 'FREIOS' },
  { GR_COD: 6, GR_DESCRI: 'SUSPENSAO' },
  { GR_COD: 7, GR_DESCRI: 'JUNTAS' },
  { GR_COD: 8, GR_DESCRI: 'INATIVO' },
  { GR_COD: 9, GR_DESCRI: 'DIVERSOS' },
  { GR_COD: 10, GR_DESCRI: 'ELETRICA' },
  { GR_COD: 11, GR_DESCRI: 'CAMBIO' },
  { GR_COD: 12, GR_DESCRI: 'DIFERENCIAL' },
  { GR_COD: 13, GR_DESCRI: 'ACESSORIOS' }
];

// --- ESTRUTURA DO BANCO DE DADOS: TABELA SUBGRUPOS ---
// Mapeamento exato da sua tabela CSV
export const DB_SUBGROUPS = [
  { GR_COD: 1, SG_COD: 1, SG_DESCRI: 'AJUSTAR SUBGRUPO' },
  { GR_COD: 2, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 3, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 4, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 5, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 6, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 7, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 8, SG_COD: 1, SG_DESCRI: 'INATIVO' },
  { GR_COD: 9, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 10, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 11, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 12, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 13, SG_COD: 1, SG_DESCRI: 'CADASTRAR SUBGRUPO' },
  { GR_COD: 1, SG_COD: 3, SG_DESCRI: 'JUNTAS DO MOTOR' },
  { GR_COD: 1, SG_COD: 2, SG_DESCRI: 'ANEIS' },
  { GR_COD: 1, SG_COD: 8, SG_DESCRI: 'PISTOES' },
  { GR_COD: 1, SG_COD: 4, SG_DESCRI: 'JUNTA SUPERIOR' },
  { GR_COD: 1, SG_COD: 5, SG_DESCRI: 'PARAFUSO DO CABECOTE' },
  { GR_COD: 1, SG_COD: 6, SG_DESCRI: 'VALVULAS DO CABECOTE' },
  { GR_COD: 1, SG_COD: 9, SG_DESCRI: 'BOMBA DE OLEO' },
  { GR_COD: 3, SG_COD: 2, SG_DESCRI: 'BOMBA AGUA' },
  { GR_COD: 3, SG_COD: 4, SG_DESCRI: 'RADIADOR' },
  { GR_COD: 5, SG_COD: 2, SG_DESCRI: 'CILINDRO MESTRE' },
  { GR_COD: 5, SG_COD: 3, SG_DESCRI: 'CILINDRO DE RODA' },
  { GR_COD: 5, SG_COD: 4, SG_DESCRI: 'PASTILHA DE FREIO' },
  { GR_COD: 5, SG_COD: 5, SG_DESCRI: 'SAPATA DE FREIO' },
  { GR_COD: 10, SG_COD: 2, SG_DESCRI: 'CABO DE VELAS' },
  { GR_COD: 10, SG_COD: 3, SG_DESCRI: 'VELAS' },
  { GR_COD: 10, SG_COD: 4, SG_DESCRI: 'TAMPA/ROTOR/COND/PLATINADO' },
  { GR_COD: 1, SG_COD: 10, SG_DESCRI: 'CARTER/PROTETOR' },
  { GR_COD: 6, SG_COD: 2, SG_DESCRI: 'PIVOS/TERMINAIS' },
  { GR_COD: 6, SG_COD: 3, SG_DESCRI: 'BARRAS DE DIRECAO' },
  { GR_COD: 6, SG_COD: 4, SG_DESCRI: 'BARRAS AXIAIS' },
  { GR_COD: 3, SG_COD: 3, SG_DESCRI: 'RESERVATORIO' },
  { GR_COD: 1, SG_COD: 7, SG_DESCRI: 'BRONZINAS' },
  { GR_COD: 6, SG_COD: 5, SG_DESCRI: 'AMORTECEDOR' },
  { GR_COD: 6, SG_COD: 6, SG_DESCRI: 'MOLAS' },
  { GR_COD: 6, SG_COD: 7, SG_DESCRI: 'CAIXA DE DIRECAO' },
  { GR_COD: 5, SG_COD: 6, SG_DESCRI: 'DISCO' },
  { GR_COD: 6, SG_COD: 8, SG_DESCRI: 'HOMOCINETICAS' },
  { GR_COD: 1, SG_COD: 11, SG_DESCRI: 'FILTRO DE OLEO' },
  { GR_COD: 2, SG_COD: 2, SG_DESCRI: 'FILTRO DE COMBUSTIVEL' },
  { GR_COD: 2, SG_COD: 3, SG_DESCRI: 'FILTRO DE AR' },
  { GR_COD: 3, SG_COD: 5, SG_DESCRI: 'VALVULA TERMOSTATICA' },
  { GR_COD: 1, SG_COD: 12, SG_DESCRI: 'JUNTA DO CABECOTE' },
  { GR_COD: 1, SG_COD: 13, SG_DESCRI: 'POLIAS E TENSORES' },
  { GR_COD: 2, SG_COD: 4, SG_DESCRI: 'CABO DE ACELERADOR' },
  { GR_COD: 2, SG_COD: 5, SG_DESCRI: 'CABO DE AFOGADOR' },
  { GR_COD: 10, SG_COD: 5, SG_DESCRI: 'BOBINAS' },
  { GR_COD: 6, SG_COD: 9, SG_DESCRI: 'BANDEJAS/BRACOS' },
  { GR_COD: 5, SG_COD: 7, SG_DESCRI: 'INATIVO' },
  { GR_COD: 1, SG_COD: 14, SG_DESCRI: 'CAMISAS' },
  { GR_COD: 1, SG_COD: 15, SG_DESCRI: 'CAPAS' },
  { GR_COD: 1, SG_COD: 16, SG_DESCRI: 'ENGRENAGEM' },
  { GR_COD: 1, SG_COD: 17, SG_DESCRI: 'TUCHO' },
  { GR_COD: 1, SG_COD: 18, SG_DESCRI: 'CORREIA DENTADA' },
  { GR_COD: 2, SG_COD: 6, SG_DESCRI: 'CARBURADOR' },
  { GR_COD: 2, SG_COD: 7, SG_DESCRI: 'MANGUEIRAS DO FILTRO DE AR' },
  { GR_COD: 2, SG_COD: 8, SG_DESCRI: 'BOMBA DE COMBUSTIVEL' },
  { GR_COD: 2, SG_COD: 9, SG_DESCRI: 'KIT DE CAR./BOIA/AGULHA' },
  { GR_COD: 3, SG_COD: 6, SG_DESCRI: 'CANOTE' },
  { GR_COD: 3, SG_COD: 7, SG_DESCRI: 'MANGUEIRAS' },
  { GR_COD: 3, SG_COD: 8, SG_DESCRI: 'CARACA DE VALVULA' },
  { GR_COD: 3, SG_COD: 9, SG_DESCRI: 'CARCACA DE BOMBA DAGUA' },
  { GR_COD: 5, SG_COD: 8, SG_DESCRI: 'LONAS' },
  { GR_COD: 5, SG_COD: 9, SG_DESCRI: 'FLEXIVEL' },
  { GR_COD: 5, SG_COD: 10, SG_DESCRI: 'CABO DE FREIO' },
  { GR_COD: 6, SG_COD: 10, SG_DESCRI: 'ROLAMENTO' },
  { GR_COD: 6, SG_COD: 11, SG_DESCRI: 'CUBO DE RODA' },
  { GR_COD: 6, SG_COD: 12, SG_DESCRI: 'BIELETAS' },
  { GR_COD: 6, SG_COD: 13, SG_DESCRI: 'BATENTE/COIFA' },
  { GR_COD: 8, SG_COD: 2, SG_DESCRI: 'INATIVO' },
  { GR_COD: 8, SG_COD: 3, SG_DESCRI: 'COXIM DE MOTOR' },
  { GR_COD: 8, SG_COD: 4, SG_DESCRI: 'INATIVO' },
  { GR_COD: 11, SG_COD: 2, SG_DESCRI: 'CABO DE EMBREAGEM' },
  { GR_COD: 11, SG_COD: 3, SG_DESCRI: 'EMBREAGEM' },
  { GR_COD: 11, SG_COD: 4, SG_DESCRI: 'CILINDRO DE EMBREAGEM' },
  { GR_COD: 11, SG_COD: 5, SG_DESCRI: 'ROLAMENTO DE EMBREAGEM' },
  { GR_COD: 11, SG_COD: 6, SG_DESCRI: 'GARFO DE EMBREAGEM' },
  { GR_COD: 11, SG_COD: 7, SG_DESCRI: 'ATUADOR' },
  { GR_COD: 6, SG_COD: 14, SG_DESCRI: 'JUNTA DESLIZANTE' },
  { GR_COD: 6, SG_COD: 15, SG_DESCRI: 'TRIZETA' },
  { GR_COD: 6, SG_COD: 16, SG_DESCRI: 'TULIPAS' },
  { GR_COD: 10, SG_COD: 6, SG_DESCRI: 'BICOS INJETORES' },
  { GR_COD: 10, SG_COD: 7, SG_DESCRI: 'REGULADOR DE PRESSAO' },
  { GR_COD: 10, SG_COD: 8, SG_DESCRI: 'SENSOR DE POSICAO' },
  { GR_COD: 10, SG_COD: 9, SG_DESCRI: 'SENSOR DE ROTACAO' },
  { GR_COD: 10, SG_COD: 10, SG_DESCRI: 'SENSOR DE TEMPERATURA' },
  { GR_COD: 10, SG_COD: 11, SG_DESCRI: 'SENSOR DE PRESSAO DE OLEO' },
  { GR_COD: 10, SG_COD: 12, SG_DESCRI: 'SENSOR MAP' },
  { GR_COD: 1, SG_COD: 19, SG_DESCRI: 'TAMPA DE OLEO' },
  { GR_COD: 3, SG_COD: 10, SG_DESCRI: 'TAMPA DO RESERVATORIO' },
  { GR_COD: 1, SG_COD: 20, SG_DESCRI: 'CORREIA DO ALTERNADOR' },
  { GR_COD: 1, SG_COD: 21, SG_DESCRI: 'JUNTAS DIVERSAS' },
  { GR_COD: 5, SG_COD: 11, SG_DESCRI: 'REPARO DA PINSA' },
  { GR_COD: 1, SG_COD: 22, SG_DESCRI: 'POLIAS (VIRAB/BBA AGUA/DH)' },
  { GR_COD: 1, SG_COD: 23, SG_DESCRI: 'RETENTORES' },
  { GR_COD: 10, SG_COD: 13, SG_DESCRI: 'INTERRUPTOR DA DIRECAO HID.' },
  { GR_COD: 10, SG_COD: 14, SG_DESCRI: 'INTERRUPTOR DE FREIO' },
  { GR_COD: 2, SG_COD: 10, SG_DESCRI: 'ATUADOR DA MARCHA LENTA' },
  { GR_COD: 6, SG_COD: 17, SG_DESCRI: 'COIFA HOMOCINETICA' },
  { GR_COD: 6, SG_COD: 18, SG_DESCRI: 'COXINS' },
  { GR_COD: 13, SG_COD: 2, SG_DESCRI: 'PALHETA' },
  { GR_COD: 10, SG_COD: 15, SG_DESCRI: 'SONDA LAMBDA' },
  { GR_COD: 2, SG_COD: 11, SG_DESCRI: 'TAMPA DA BOMBA DE COMB.' },
  { GR_COD: 2, SG_COD: 12, SG_DESCRI: 'FLANGE DA BOMBA' },
  { GR_COD: 6, SG_COD: 19, SG_DESCRI: 'BUCHAS' },
  { GR_COD: 1, SG_COD: 24, SG_DESCRI: 'COMANDO DE VALVULAS' },
  { GR_COD: 1, SG_COD: 25, SG_DESCRI: 'ANTI-CHA/VALV./COTOV./CARC./ENG.DIST.' },
  { GR_COD: 5, SG_COD: 12, SG_DESCRI: 'ALAVANCA DE FREIO' },
  { GR_COD: 11, SG_COD: 8, SG_DESCRI: 'ALAVANCA DE CAMBIO' },
  { GR_COD: 13, SG_COD: 3, SG_DESCRI: 'LAMPADAS' },
  { GR_COD: 1, SG_COD: 26, SG_DESCRI: 'OLEO' },
  { GR_COD: 5, SG_COD: 13, SG_DESCRI: 'OLEO DE FREIO' },
  { GR_COD: 10, SG_COD: 16, SG_DESCRI: 'BATERIA' },
  { GR_COD: 13, SG_COD: 4, SG_DESCRI: 'SPRAYS' },
  { GR_COD: 1, SG_COD: 27, SG_DESCRI: 'COLAS E SILICONES' },
  { GR_COD: 1, SG_COD: 28, SG_DESCRI: 'SELOS' },
  { GR_COD: 1, SG_COD: 29, SG_DESCRI: 'VARETA DE OLEO' },
  { GR_COD: 1, SG_COD: 30, SG_DESCRI: 'KIT DE MOTOR' },
  { GR_COD: 10, SG_COD: 17, SG_DESCRI: 'PLUG ELETRONICO' },
  { GR_COD: 1, SG_COD: 31, SG_DESCRI: 'JUNTA ADM/ESC' },
  { GR_COD: 1, SG_COD: 32, SG_DESCRI: 'JUNTA TAMPA DE VALVULA' },
  { GR_COD: 1, SG_COD: 33, SG_DESCRI: 'JUNTA DO CARTER' },
  { GR_COD: 1, SG_COD: 34, SG_DESCRI: 'CALCO' },
  { GR_COD: 10, SG_COD: 18, SG_DESCRI: 'MODULOS' },
  { GR_COD: 6, SG_COD: 20, SG_DESCRI: 'PONTA DE EIXO' },
  { GR_COD: 2, SG_COD: 13, SG_DESCRI: 'GUARNICAO DA TAMPA DA BOMB.' },
  { GR_COD: 2, SG_COD: 14, SG_DESCRI: 'PRE-FILTRO' },
  { GR_COD: 1, SG_COD: 35, SG_DESCRI: 'HOMOGENIZADOR' },
  { GR_COD: 2, SG_COD: 15, SG_DESCRI: 'BICO INJETOR' },
  { GR_COD: 5, SG_COD: 14, SG_DESCRI: 'SERVO FREIO' },
  { GR_COD: 6, SG_COD: 21, SG_DESCRI: 'AMORTECEDOR TAMPA TRASEIRA' },
  { GR_COD: 11, SG_COD: 9, SG_DESCRI: 'JUNTA DE CAMBIO' },
  { GR_COD: 1, SG_COD: 36, SG_DESCRI: 'KIT DA DISTRIBUICAO' },
  { GR_COD: 3, SG_COD: 11, SG_DESCRI: 'TAMPA DO RADIADOR' },
  { GR_COD: 1, SG_COD: 37, SG_DESCRI: 'BALANCIM' },
  { GR_COD: 5, SG_COD: 15, SG_DESCRI: 'TAMBOR DE FREIO' },
  { GR_COD: 1, SG_COD: 38, SG_DESCRI: 'RESFRIADOR DE OLEO' },
  { GR_COD: 6, SG_COD: 22, SG_DESCRI: 'SEMI EIXO' },
  { GR_COD: 1, SG_COD: 39, SG_DESCRI: 'TAMPA DA VALVULA' },
  { GR_COD: 10, SG_COD: 19, SG_DESCRI: 'ELETROVENTILADOR' }
];

// --- LOGICA DE FRONTEND (Ícones e Mapeamento) ---

// Função auxiliar para determinar o ícone com base no nome do subgrupo
// Mapeamento extenso para cobrir peças automotivas específicas
const getIconByTerm = (term: string): string => {
    const t = term.toUpperCase();

    // -- Itens Genéricos ou Administrativos --
    if (t.includes('INATIVO') || t.includes('AJUSTAR') || t.includes('CADASTRAR')) return 'edit_off';
    
    // -- Motor --
    if (t.includes('ANEIS')) return 'circle'; // Anéis
    if (t.includes('PISTAO') || t.includes('PISTOES')) return 'memory'; // Pistões
    if (t.includes('JUNTA') || t.includes('RETENTOR')) return 'layers'; // Juntas e Retentores
    if (t.includes('VALVULA') && t.includes('CABECOTE')) return 'valve'; // Válvulas
    if (t.includes('BOMBA') && t.includes('OLEO')) return 'oil_barrel'; // Bomba Óleo
    if (t.includes('FILTRO') && t.includes('OLEO')) return 'filter_alt'; // Filtro Óleo
    if (t.includes('CORREIA')) return 'all_inclusive'; // Correias
    if (t.includes('CAMISA')) return 'view_week'; // Camisas
    if (t.includes('BRONZINA')) return 'settings_input_component'; // Bronzinas
    if (t.includes('CARTER')) return 'inbox'; // Carter
    if (t.includes('COMANDO')) return 'settings_applications'; // Comando
    if (t.includes('TUCHO') || t.includes('BALANCIM')) return 'smart_button'; // Tucho
    if (t.includes('VARETA')) return 'linear_scale'; // Vareta
    if (t.includes('SELO')) return 'verified'; // Selos do motor
    if (t.includes('COLA') || t.includes('SILICONE')) return 'vaccines'; // Colas/Químicos

    // -- Arrefecimento/Refrigeração --
    if (t.includes('RADIADOR')) return 'grid_on'; 
    if (t.includes('BOMBA') && t.includes('AGUA')) return 'water_drop'; 
    if (t.includes('RESERVATORIO')) return 'propane_tank'; 
    if (t.includes('TERMOSTATICA')) return 'device_thermostat';
    if (t.includes('MANGUEIRA')) return 'gesture';
    if (t.includes('ELETROVENTILADOR')) return 'mode_fan';

    // -- Alimentação --
    if (t.includes('BICO')) return 'colorize'; // Injetor parece uma seringa/bico
    if (t.includes('CARBURADOR')) return 'settings_input_composite';
    if (t.includes('FILTRO') && t.includes('AR')) return 'air';
    if (t.includes('FILTRO') && t.includes('COMBUSTIVEL')) return 'filter_alt_off';
    if (t.includes('BOMBA') && t.includes('COMBUSTIVEL')) return 'local_gas_station';

    // -- Freios --
    if (t.includes('PASTILHA')) return 'rectangle';
    if (t.includes('DISCO')) return 'disc_full';
    if (t.includes('CILINDRO')) return 'cylinder'; // Cilindro mestre/roda
    if (t.includes('SAPATA') || t.includes('LONA')) return 'incomplete_circle'; 
    if (t.includes('TAMBOR')) return 'radio_button_unchecked';
    if (t.includes('SERVO')) return 'power_input';
    if (t.includes('FLEXIVEL')) return 'cable'; // Flexível de freio

    // -- Suspensão e Direção --
    if (t.includes('AMORTECEDOR')) return 'compress';
    if (t.includes('MOLA')) return 'waves';
    if (t.includes('PIVO')) return 'radio_button_checked';
    if (t.includes('TERMINAL') || t.includes('BIELETA')) return 'linear_scale';
    if (t.includes('BANDEJA') || t.includes('BRACO')) return 'change_history'; // Triângulo
    if (t.includes('HOMOCINETICA') || t.includes('TRIZETA')) return 'settings_system_daydream';
    if (t.includes('ROLAMENTO')) return 'donut_small';
    if (t.includes('CUBO')) return 'settings_brightness';
    if (t.includes('CAIXA') && t.includes('DIRECAO')) return 'agriculture'; // Lembra eixo
    if (t.includes('COXIM') || t.includes('BUCHA')) return 'vibration';

    // -- Elétrica --
    if (t.includes('BATERIA')) return 'battery_full';
    if (t.includes('VELA')) return 'flash_on';
    if (t.includes('CABO') && t.includes('VELA')) return 'cable';
    if (t.includes('BOBINA')) return 'electric_bolt';
    if (t.includes('ALTERNADOR') || t.includes('MOTOR PARTIDA')) return 'cyclone';
    if (t.includes('LAMPADA') || t.includes('FAROL')) return 'lightbulb';
    if (t.includes('SENSOR') || t.includes('SONDA')) return 'sensors';
    if (t.includes('INTERRUPTOR')) return 'toggle_on';
    if (t.includes('MODULO')) return 'developer_board';
    if (t.includes('FUSIVEL')) return 'power';

    // -- Transmissão --
    if (t.includes('EMBREAGEM') || t.includes('KIT')) return 'album'; // Lembra o platô
    if (t.includes('ATUADOR')) return 'settings_power';
    if (t.includes('ENGRENAGEM')) return 'settings';
    if (t.includes('ALAVANCA')) return 'joystick';

    // -- Acessórios/Diversos --
    if (t.includes('PALHETA')) return 'wiper';
    if (t.includes('SPRAY') || t.includes('OLEO') || t.includes('LUBRIFICANTE')) return 'cleaning_services';
    if (t.includes('PARAFUSO') || t.includes('PORCA')) return 'more_horiz';
    
    // -- Fallback Inteligente --
    if (t.includes('TAMPA')) return 'expand_less';
    if (t.includes('CABO')) return 'cable';
    if (t.includes('REPARO')) return 'build';
    if (t.includes('KIT')) return 'inventory';
    
    return 'circle'; // Default final
};

// Mapa manual apenas para os Grupos Principais (Ícones das Categorias)
const GROUP_ICONS: Record<number, string> = {
  1: 'car_repair',        // MOTOR
  2: 'local_gas_station', // ALIMENTACAO
  3: 'mode_fan',          // REFRIGERACAO
  4: 'album',             // EMBREAGEM
  5: 'motion_photos_on',  // FREIOS
  6: 'height',            // SUSPENSAO
  7: 'layers',            // JUNTAS
  8: 'block',             // INATIVO
  9: 'category',          // DIVERSOS
  10: 'bolt',             // ELETRICA
  11: 'settings',         // CAMBIO
  12: 'device_hub',       // DIFERENCIAL
  13: 'extension'         // ACESSORIOS
};

// --- TIPO EXPORTADO PARA O APP ---
export interface Category {
  id: string; 
  db_id: number;
  label: string;
  icon: string;
  count: number;
  subcategories: { id: string; name: string; count: number; icon: string }[];
}

// --- GERAÇÃO DOS DADOS COMBINADOS (JOIN) ---
export const CATEGORIES_DATA: Category[] = DB_CATEGORIES.map(group => {
  // 1. Encontrar todos os subgrupos que pertencem a este grupo (SQL: WHERE GR_COD = x)
  const subItems = DB_SUBGROUPS.filter(sg => sg.GR_COD === group.GR_COD);
  
  // 2. Calcular contagem total (soma simulada)
  // No mundo real, isso viria de uma query count(products).
  // Aqui geramos um número determinístico baseado no ID para parecer real mas fixo.
  const totalCount = subItems.reduce((acc, curr) => acc + ((curr.SG_COD * 15) % 100) + 5, 0);

  // 3. Mapear subgrupos para o formato da UI
  const mappedSubcategories = subItems.map(sg => ({
      id: sg.SG_COD.toString(),
      name: sg.SG_DESCRI,
      // Simula quantidade de itens no estoque para este subgrupo
      count: ((sg.SG_COD * 23) % 200) + 10, 
      icon: getIconByTerm(sg.SG_DESCRI)
  }));

  return {
    id: group.GR_COD.toString(),
    db_id: group.GR_COD,
    label: group.GR_DESCRI,
    icon: GROUP_ICONS[group.GR_COD] || 'inventory_2',
    count: totalCount || 0,
    subcategories: mappedSubcategories
  };
});
