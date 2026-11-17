/**
 * MÓDULO: THEME & I18N MANAGER (Português, English, Español)
 * Responsável por:
 * 1. Alternância e persistência de Tema (Dark Mode / Light Mode) estilo Sentinel Cobalt.
 * 2. Internacionalização completa da interface (PT, EN, ES) em tempo real.
 */

const I18nManager = (() => {
  const STORAGE_THEME_KEY = 'gestor_rep_theme';
  const STORAGE_LANG_KEY = 'gestor_rep_lang';

  let currentLang = 'pt';
  let currentTheme = 'dark';

  const FLAGS = {
    pt: `<svg class="w-4 h-3 rounded-[2px] shadow-xs flex-shrink-0" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="2" fill="#009B3A"/><path d="M14 2.5L25.5 10L14 17.5L2.5 10L14 2.5Z" fill="#FEDF00"/><circle cx="14" cy="10" r="4.2" fill="#002776"/><path d="M10.2 9.2C12.5 8.2 15.5 8.5 17.8 10.2" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round"/></svg>`,
    en: `<svg class="w-4 h-3 rounded-[2px] shadow-xs flex-shrink-0" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="2" fill="#FFFFFF"/><path d="M0 0H28V2.2H0V0ZM0 4.4H28V6.6H0V4.4ZM0 8.8H28V11H0V8.8ZM0 13.2H28V15.4H0V13.2ZM0 17.6H28V20H0V17.6Z" fill="#B22234"/><rect width="12" height="11" rx="1" fill="#3C3B6E"/><circle cx="3" cy="3" r="0.8" fill="white"/><circle cx="6" cy="3" r="0.8" fill="white"/><circle cx="9" cy="3" r="0.8" fill="white"/><circle cx="4.5" cy="5.5" r="0.8" fill="white"/><circle cx="7.5" cy="5.5" r="0.8" fill="white"/><circle cx="3" cy="8" r="0.8" fill="white"/><circle cx="6" cy="8" r="0.8" fill="white"/><circle cx="9" cy="8" r="0.8" fill="white"/></svg>`,
    es: `<svg class="w-4 h-3 rounded-[2px] shadow-xs flex-shrink-0" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="2" fill="#AA151B"/><rect y="5" width="28" height="10" fill="#F1BF00"/><rect x="6" y="7.5" width="3" height="5" rx="1" fill="#AA151B"/></svg>`
  };

  const LANG_LABELS = {
    pt: 'PT',
    en: 'EN',
    es: 'ES'
  };

  const dictionary = {
    pt: {
      page_title: 'Gestor de Representantes por Município - Brasil',
      page_title_away: '📍 Voltar para a página | Gestor de Representantes',
      header_title: 'Gestor de Representantes',
      header_subtitle: 'Distribuição territorial e malhas geográficas por município',
      nav_manual: 'Cadastro Manual',
      nav_excel: 'Importar Excel',
      nav_sugestoes: 'Sugestão de Divisões',
      nav_em_breve: 'Em Breve',
      nav_ajuda: 'Ajuda (Guia de Uso)',
      card_title_manual: 'Cadastro Manual de Representante',
      card_title_massa: 'Importação em Massa via Excel',
      label_estado: '1. Estado (UF)',
      opt_carregando_estados: 'Carregando Estados...',
      opt_selecione_estado: 'Selecione um Estado...',
      opt_erro_estados: 'Erro ao carregar Estados',
      label_municipio: '2. Município (ou clique no mapa)',
      opt_selecione_estado_primeiro: 'Selecione um Estado primeiro',
      opt_carregando_municipios: 'Carregando municípios...',
      opt_selecione_municipio: 'Selecione um Município ou clique no mapa...',
      opt_erro_municipios: 'Erro ao carregar municípios',
      label_carregando_malhas: 'Carregando malhas...',
      label_qtd_municipios: '{n} municípios',
      helper_buscando_contorno: 'Buscando contorno da cidade no IBGE...',
      label_marca: '3. Marca Representada (até 6 por cidade)',
      btn_renomear_marcas: 'Renomear',
      opt_marca_ocupada: '{nome} (Já cadastrada nesta cidade)',
      opt_cidade_esgotada: '{nome} (6/6 marcas - Esgotado)',
      opt_cidade_parcial: '{nome} ({n}/6 marcas cadastradas)',
      label_nome_rep: '4. Nome do Representante',
      placeholder_nome_rep: 'Ex: Lucas Ferreira',
      helper_cor_auto: 'Ao digitar um representante cadastrado, a cor dele é carregada automaticamente.',
      label_cor_destaque: '5. Cor de Destaque no Mapa',
      title_cor_aleatoria: 'Gerar cor aleatória',
      btn_salvar_rep: 'Salvar Representante',
      summary_estado: 'Estado Selecionado:',
      summary_nenhum: 'Nenhum',
      summary_nenhum_selecionado: 'Nenhum selecionado',
      summary_cidades_rep: 'Cidades com Representante:',
      summary_cadastrada_one: '{n} cadastrada',
      summary_cadastrada_other: '{n} cadastradas',
      summary_cidade_cadastrada_one: '{n} cidade cadastrada',
      summary_cidade_cadastrada_other: '{n} cidades cadastradas',
      summary_cidades_disp: 'Cidades Disponíveis no Estado:',
      summary_disponiveis: '{livres} de {total} disponíveis',
      tip_label: 'Dica:',
      tip_text: 'Você pode clicar diretamente em qualquer cidade no mapa para selecioná-la de imediato!',
      excel_lote_title: 'Importação de Marcas em Lote:',
      excel_step_1: 'Selecione o Estado desejado.',
      excel_step_2: 'Baixe a planilha modelo (.xlsx) contendo as colunas de Município e Marca.',
      excel_step_3: 'Preencha as linhas (até 6 marcas por cidade) e suba a planilha abaixo.',
      btn_baixar_modelo: 'Baixar Planilha Modelo (.xlsx)',
      info_nenhum_estado: 'Nenhum Estado selecionado',
      info_estado_selecionado: 'Estado Selecionado: {nome} ({sigla})',
      drop_click: 'Clique para selecionar',
      drop_drag: ' ou arraste a planilha',
      drop_support: 'Suporta arquivos Excel (.xlsx, .xls)',
      excel_cols_title: 'Padrão das Colunas da Planilha (.xlsx):',
      excel_col_1: '• <strong>ID IBGE:</strong> Código oficial de 7 dígitos da cidade.',
      excel_col_2: '• <strong>Estado & Município:</strong> Nomes da unidade federativa e município.',
      excel_col_3: '• <strong>Marca:</strong> Marca 1 a 6 que atenderá a localidade.',
      excel_col_4: '• <strong>Representante & Cor Hex:</strong> Nome do profissional e cor de destaque no mapa.',
      map_camada: 'Camada:',
      map_camadas: 'Camadas',
      map_satelite: 'Satélite',
      map_ajustes: 'Ajustes:',
      map_ajustes_card: 'Ajustes',
      map_divisoes: 'Divisões',
      map_rotulos: 'Rótulos',
      map_enquadrar: 'Enquadrar',
      map_tela_cheia: 'Tela Cheia',
      map_sair: 'Sair',
      map_sair_tela_cheia: 'Sair da Tela Cheia',
      legend_borda_estado: 'Borda Estado',
      legend_divisoes: 'Divisões de Cidades',
      legend_edicao: 'Edição',
      metric_municipios: 'Municípios:',
      metric_representantes: 'Representantes:',
      btn_baixar_pacote: 'Baixar Pacote (.zip)',
      export_step_1: 'Renderizando mapa vetorial executivo...',
      export_step_2: 'Gerando planilha Excel padronizada...',
      export_step_3: 'Gerando Relatório Executivo em PDF (2 páginas)...',
      export_step_4: 'Compactando pacote .zip executivo...',
      table_title: 'Municípios e Representantes',
      table_subtitle: 'Listagem completa',
      table_count_one: '{n} item',
      table_count_other: '{n} itens',
      table_search_placeholder: 'Filtrar por cidade, marca ou nome...',
      th_num: 'Nº',
      th_cor: 'Cor',
      th_estado: 'Estado',
      th_municipio: 'Município',
      th_marca: 'Marca',
      th_representante: 'Representante',
      th_acoes: 'Ações',
      table_empty_no_items: 'Nenhum município cadastrado ainda.',
      table_empty_no_results: 'Nenhum registro encontrado para a busca.',
      title_focar_mapa: 'Focar no mapa',
      title_remover_registro: 'Remover registro',
      title_editar_rep: 'Editar nome ou cor de {nome}',
      popup_marcas_count: '({n}/6 marcas)',
      popup_tip_edit: '💡 Clique no lápis ou na cor para editar nome e cor do representante',
      modal_marcas_title: 'Personalizar Nomes das 6 Marcas',
      modal_marcas_desc: 'Defina os nomes das marcas da sua operação. Essas alterações refletem no mapa, na tabela e nos relatórios exportados.',
      btn_salvar_nomes: 'Salvar Nomes',
      modal_sug_title: 'Sugestão de Divisões Territoriais',
      modal_sug_badge: 'Em Desenvolvimento',
      modal_sug_intro: 'Estamos desenvolvendo um algoritmo de agrupamento geográfico inteligente:',
      modal_sug_item1: '<strong>Agrupamento por Proximidade:</strong> Divisão em carteiras de municípios vizinhos para otimizar tempo de deslocamento.',
      modal_sug_item2: '<strong>Balanceamento Populacional:</strong> Distribuição equilibrada de cidades por potencial populacional.',
      btn_fechar: 'Fechar',
      modal_ajuda_title: 'Guia Prático de Utilização',
      modal_ajuda_sub: 'Aprenda a operar o gestor territorial de ponta a ponta',
      ajuda_1_title: 'Seleção do Estado e Divisões Municipais',
      ajuda_1_desc: 'Selecione um Estado no menu. O mapa enquadra a região e traça as <strong>fronteiras do Estado</strong> e todas as <strong>divisões de cidades</strong> em cores de alto contraste.',
      ajuda_2_title: 'Cadastro com 1 Clique Direto no Mapa',
      ajuda_2_desc: 'Você pode selecionar cidades pelo formulário ou <strong>clicando diretamente sobre a cidade no mapa</strong>.',
      ajuda_3_title: 'Múltiplas Marcas por Município',
      ajuda_3_desc: 'Cada município aceita até 6 marcas. Cidades com mais de uma marca exibem <strong>listras diagonais</strong> com as cores correspondentes no mapa.',
      ajuda_4_title: 'Exportação do Pacote (.zip)',
      ajuda_4_desc: 'O botão <strong>Baixar Pacote (.zip)</strong> sempre fotografa o Estado inteiro perfeitamente enquadrado e gera:',
      ajuda_4_li1: '<strong>mapa_representantes.png:</strong> Foto do Estado em alta resolução.',
      ajuda_4_li2: '<strong>tabela_representantes.xlsx:</strong> Planilha com cores em ARGB.',
      ajuda_4_li3: '<strong>relatorio_representantes.pdf:</strong> PDF de 2 páginas (Página 1 com o Mapa Colorido e Página 2 com a Legenda Completa).',
      btn_fechar_guia: 'Fechar Guia',
      modal_cor_title: 'Editar Representante',
      modal_cor_sub_default: 'Alteração de Nome e Cor',
      modal_cor_sub_atual: 'Atualmente: {nome}',
      modal_cor_label_nome: 'Nome do Representante:',
      modal_cor_placeholder_nome: 'Digite o nome do representante...',
      modal_cor_info_one: 'Este representante atende {n} município. O novo nome e cor serão aplicados a todas as ocorrências.',
      modal_cor_info_other: 'Este representante atende {n} municípios. O novo nome e cor serão aplicados a todas as ocorrências.',
      modal_cor_label_paleta: 'Cor Institucional (1 Toque):',
      modal_cor_label_custom: 'Ou personalize com a cor exata:',
      btn_cancelar: 'Cancelar',
      btn_salvar_alteracoes: 'Salvar Alterações',
      footer_text: 'Gestor Territorial de Representantes • Dados geográficos providos pelo IBGE • Memória volátil (100% em memória)',
      modal_prog_title: 'Processando Importação',
      modal_prog_sub: 'Consultando malhas cartográficas no IBGE...',
      modal_prog_count: '{atual} de {total} municípios',
      modal_prog_note: 'Isso pode levar alguns segundos dependendo da quantidade de cidades.',
      toast_marcas_ok: 'Nomes das marcas atualizados com sucesso!',
      toast_erro_estados: 'Falha ao carregar estados do IBGE.',
      toast_erro_ibge_uf: 'Falha ao carregar dados do IBGE para o estado.',
      toast_erro_contorno: 'Não foi possível obter o contorno do município no IBGE.',
      toast_sel_estado: 'Selecione um Estado.',
      toast_sel_municipio: 'Selecione um Município ou clique diretamente no mapa.',
      toast_sel_marca: 'Selecione uma Marca.',
      toast_digite_rep: 'Digite o nome do Representante.',
      toast_marca_existe: 'Esta marca já está cadastrada para este município!',
      toast_limite_marcas: 'Limite máximo de 6 marcas por município atingido!',
      toast_erro_malha: 'Erro ao obter malha do município no IBGE.',
      toast_nome_vazio: 'O nome do representante não pode ficar em branco.',
      toast_rep_atualizado_one: 'Representante atualizado para "{nome}" ({n} município no mapa)!',
      toast_rep_atualizado_other: 'Representante atualizado para "{nome}" ({n} municípios no mapa)!',
      toast_sel_estado_modelo: 'Selecione primeiro um Estado para gerar a planilha modelo.',
      toast_aguarde_municipios: 'Aguarde o carregamento dos municípios.',
      toast_modelo_baixado: 'Modelo de planilha baixado ({n} cidades).',
      toast_arq_invalido: 'Selecione um arquivo Excel (.xlsx ou .xls).',
      toast_planilha_vazia: 'Nenhuma linha preenchida com Representante e ID IBGE encontrada.',
      toast_erro_planilha: 'Erro ao ler a planilha: ',
      toast_import_ok: 'Importação concluída! {add} adicionados com sucesso{err}.',
      toast_import_err_part: ', {erros} com falha',
      toast_cadastre_antes: 'Cadastre ao menos um município antes de exportar o pacote.',
      toast_pacote_ok: 'Relatório Executivo gerado com sucesso (PDF Geomarketing + Mapa HD + Excel)!',
      toast_erro_pacote: 'Erro ao exportar pacote: '
    },

    en: {
      page_title: 'Sales Representative Territory Manager - Brazil',
      page_title_away: '📍 Return to page | Territory Manager',
      header_title: 'Representative Manager',
      header_subtitle: 'Territorial distribution and geographic boundaries by municipality',
      nav_manual: 'Manual Entry',
      nav_excel: 'Import Excel',
      nav_sugestoes: 'Territory Suggestions',
      nav_em_breve: 'Soon',
      nav_ajuda: 'Help (User Guide)',
      card_title_manual: 'Manual Representative Entry',
      card_title_massa: 'Bulk Import via Excel',
      label_estado: '1. State (UF)',
      opt_carregando_estados: 'Loading States...',
      opt_selecione_estado: 'Select a State...',
      opt_erro_estados: 'Error loading States',
      label_municipio: '2. Municipality (or click on map)',
      opt_selecione_estado_primeiro: 'Select a State first',
      opt_carregando_municipios: 'Loading municipalities...',
      opt_selecione_municipio: 'Select a Municipality or click on map...',
      opt_erro_municipios: 'Error loading municipalities',
      label_carregando_malhas: 'Loading meshes...',
      label_qtd_municipios: '{n} municipalities',
      helper_buscando_contorno: 'Fetching city boundary from IBGE...',
      label_marca: '3. Represented Brand (up to 6 per city)',
      btn_renomear_marcas: 'Rename',
      opt_marca_ocupada: '{nome} (Already registered in this city)',
      opt_cidade_esgotada: '{nome} (6/6 brands - Full)',
      opt_cidade_parcial: '{nome} ({n}/6 brands registered)',
      label_nome_rep: '4. Representative Name',
      placeholder_nome_rep: 'E.g.: Lucas Ferreira',
      helper_cor_auto: 'When typing an existing representative, their assigned color loads automatically.',
      label_cor_destaque: '5. Map Highlight Color',
      title_cor_aleatoria: 'Generate random color',
      btn_salvar_rep: 'Save Representative',
      summary_estado: 'Selected State:',
      summary_nenhum: 'None',
      summary_nenhum_selecionado: 'None selected',
      summary_cidades_rep: 'Cities with Representative:',
      summary_cadastrada_one: '{n} registered',
      summary_cadastrada_other: '{n} registered',
      summary_cidade_cadastrada_one: '{n} city registered',
      summary_cidade_cadastrada_other: '{n} cities registered',
      summary_cidades_disp: 'Available Cities in State:',
      summary_disponiveis: '{livres} of {total} available',
      tip_label: 'Tip:',
      tip_text: 'You can click directly on any city on the map to select it immediately!',
      excel_lote_title: 'Bulk Brand Import:',
      excel_step_1: 'Select the desired State.',
      excel_step_2: 'Download the template spreadsheet (.xlsx) with Municipality and Brand columns.',
      excel_step_3: 'Fill in the rows (up to 6 brands per city) and upload the file below.',
      btn_baixar_modelo: 'Download Template (.xlsx)',
      info_nenhum_estado: 'No State selected',
      info_estado_selecionado: 'Selected State: {nome} ({sigla})',
      drop_click: 'Click to select',
      drop_drag: ' or drag the spreadsheet',
      drop_support: 'Supports Excel files (.xlsx, .xls)',
      excel_cols_title: 'Spreadsheet Column Standard (.xlsx):',
      excel_col_1: '• <strong>ID IBGE:</strong> Official 7-digit city code.',
      excel_col_2: '• <strong>State & Municipality:</strong> State and municipality names.',
      excel_col_3: '• <strong>Brand:</strong> Brand 1 to 6 serving the location.',
      excel_col_4: '• <strong>Representative & Hex Color:</strong> Representative name and map color.',
      map_camada: 'Layer:',
      map_camadas: 'Layers',
      map_satelite: 'Satellite',
      map_ajustes: 'Settings:',
      map_ajustes_card: 'Settings',
      map_divisoes: 'Borders',
      map_rotulos: 'Labels',
      map_enquadrar: 'Fit View',
      map_tela_cheia: 'Fullscreen',
      map_sair: 'Exit',
      map_sair_tela_cheia: 'Exit Fullscreen',
      legend_borda_estado: 'State Border',
      legend_divisoes: 'City Borders',
      legend_edicao: 'Editing',
      metric_municipios: 'Municipalities:',
      metric_representantes: 'Representatives:',
      btn_baixar_pacote: 'Download Package (.zip)',
      export_step_1: 'Rendering executive vector map...',
      export_step_2: 'Generating styled Excel spreadsheet...',
      export_step_3: 'Generating Executive PDF Report (2 pages)...',
      export_step_4: 'Compressing executive .zip package...',
      table_title: 'Municipalities & Representatives',
      table_subtitle: 'Complete listing',
      table_count_one: '{n} item',
      table_count_other: '{n} items',
      table_search_placeholder: 'Filter by city, brand, or name...',
      th_num: 'No.',
      th_cor: 'Color',
      th_estado: 'State',
      th_municipio: 'Municipality',
      th_marca: 'Brand',
      th_representante: 'Representative',
      th_acoes: 'Actions',
      table_empty_no_items: 'No municipalities registered yet.',
      table_empty_no_results: 'No matching records found.',
      title_focar_mapa: 'Focus on map',
      title_remover_registro: 'Remove record',
      title_editar_rep: 'Edit name or color of {nome}',
      popup_marcas_count: '({n}/6 brands)',
      popup_tip_edit: '💡 Click the pencil or color dot to edit representative name and color',
      modal_marcas_title: 'Customize 6 Brand Names',
      modal_marcas_desc: 'Define the brand names for your operation. Changes reflect on the map, table, and exported reports.',
      btn_salvar_nomes: 'Save Names',
      modal_sug_title: 'Territorial Division Suggestions',
      modal_sug_badge: 'In Development',
      modal_sug_intro: 'We are developing an intelligent geographic clustering algorithm:',
      modal_sug_item1: '<strong>Proximity Clustering:</strong> Grouping neighboring municipalities to optimize travel time.',
      modal_sug_item2: '<strong>Population Balancing:</strong> Balanced distribution of cities by population potential.',
      btn_fechar: 'Close',
      modal_ajuda_title: 'Practical User Guide',
      modal_ajuda_sub: 'Learn how to operate the territory manager end-to-end',
      ajuda_1_title: 'State Selection & Municipal Borders',
      ajuda_1_desc: 'Select a State from the menu. The map frames the region and draws the <strong>State borders</strong> and all <strong>city divisions</strong> in high-contrast colors.',
      ajuda_2_title: '1-Click Direct Registration on Map',
      ajuda_2_desc: 'You can select cities via the form or by <strong>clicking directly on any city on the map</strong>.',
      ajuda_3_title: 'Multiple Brands per Municipality',
      ajuda_3_desc: 'Each municipality accepts up to 6 brands. Cities with multiple brands display <strong>diagonal stripes</strong> with their respective colors on the map.',
      ajuda_4_title: 'Package Export (.zip)',
      ajuda_4_desc: 'The <strong>Download Package (.zip)</strong> button captures the entire State framed and generates:',
      ajuda_4_li1: '<strong>mapa_representantes.png:</strong> High-resolution executive state map.',
      ajuda_4_li2: '<strong>tabela_representantes.xlsx:</strong> Spreadsheet with ARGB color swatches.',
      ajuda_4_li3: '<strong>relatorio_representantes.pdf:</strong> 2-page PDF (Page 1: Colored Map, Page 2: Full Legend).',
      btn_fechar_guia: 'Close Guide',
      modal_cor_title: 'Edit Representative',
      modal_cor_sub_default: 'Change Name & Color',
      modal_cor_sub_atual: 'Currently: {nome}',
      modal_cor_label_nome: 'Representative Name:',
      modal_cor_placeholder_nome: 'Enter representative name...',
      modal_cor_info_one: 'This representative serves {n} municipality. The new name and color will apply to all occurrences.',
      modal_cor_info_other: 'This representative serves {n} municipalities. The new name and color will apply to all occurrences.',
      modal_cor_label_paleta: 'Corporate Color (1-Tap):',
      modal_cor_label_custom: 'Or customize with exact color:',
      btn_cancelar: 'Cancel',
      btn_salvar_alteracoes: 'Save Changes',
      footer_text: 'Representative Territory Manager • Geographic data provided by IBGE • Volatile memory (100% in-RAM)',
      modal_prog_title: 'Processing Import',
      modal_prog_sub: 'Fetching cartographic meshes from IBGE...',
      modal_prog_count: '{atual} of {total} municipalities',
      modal_prog_note: 'This may take a few seconds depending on the number of cities.',
      toast_marcas_ok: 'Brand names updated successfully!',
      toast_erro_estados: 'Failed to load states from IBGE.',
      toast_erro_ibge_uf: 'Failed to load IBGE data for the selected state.',
      toast_erro_contorno: 'Could not fetch municipality boundary from IBGE.',
      toast_sel_estado: 'Please select a State.',
      toast_sel_municipio: 'Please select a Municipality or click directly on the map.',
      toast_sel_marca: 'Please select a Brand.',
      toast_digite_rep: 'Please enter the Representative name.',
      toast_marca_existe: 'This brand is already registered for this municipality!',
      toast_limite_marcas: 'Maximum limit of 6 brands per municipality reached!',
      toast_erro_malha: 'Error fetching municipality mesh from IBGE.',
      toast_nome_vazio: 'Representative name cannot be empty.',
      toast_rep_atualizado_one: 'Representative updated to "{nome}" ({n} municipality on map)!',
      toast_rep_atualizado_other: 'Representative updated to "{nome}" ({n} municipalities on map)!',
      toast_sel_estado_modelo: 'Select a State first to generate the template spreadsheet.',
      toast_aguarde_municipios: 'Please wait for municipalities to load.',
      toast_modelo_baixado: 'Spreadsheet template downloaded ({n} cities).',
      toast_arq_invalido: 'Please select an Excel file (.xlsx or .xls).',
      toast_planilha_vazia: 'No rows filled with Representative and IBGE ID found.',
      toast_erro_planilha: 'Error reading spreadsheet: ',
      toast_import_ok: 'Import completed! {add} added successfully{err}.',
      toast_import_err_part: ', {erros} failed',
      toast_cadastre_antes: 'Register at least one municipality before exporting the package.',
      toast_pacote_ok: 'Executive Report generated successfully (Geomarketing PDF + HD Map + Excel)!',
      toast_erro_pacote: 'Error exporting package: '
    },

    es: {
      page_title: 'Gestor de Representantes por Municipio - Brasil',
      page_title_away: '📍 Volver a la página | Gestor de Representantes',
      header_title: 'Gestor de Representantes',
      header_subtitle: 'Distribución territorial y mallas geográficas por municipio',
      nav_manual: 'Registro Manual',
      nav_excel: 'Importar Excel',
      nav_sugestoes: 'Sugerencia de Divisiones',
      nav_em_breve: 'Pronto',
      nav_ajuda: 'Ayuda (Guía de Uso)',
      card_title_manual: 'Registro Manual de Representante',
      card_title_massa: 'Importación Masiva vía Excel',
      label_estado: '1. Estado (UF)',
      opt_carregando_estados: 'Cargando Estados...',
      opt_selecione_estado: 'Seleccione un Estado...',
      opt_erro_estados: 'Error al cargar Estados',
      label_municipio: '2. Municipio (o clic en el mapa)',
      opt_selecione_estado_primeiro: 'Seleccione un Estado primero',
      opt_carregando_municipios: 'Cargando municipios...',
      opt_selecione_municipio: 'Seleccione un Municipio o clic en el mapa...',
      opt_erro_municipios: 'Error al cargar municipios',
      label_carregando_malhas: 'Cargando mallas...',
      label_qtd_municipios: '{n} municipios',
      helper_buscando_contorno: 'Buscando contorno de la ciudad en IBGE...',
      label_marca: '3. Marca Representada (hasta 6 por ciudad)',
      btn_renomear_marcas: 'Renombrar',
      opt_marca_ocupada: '{nome} (Ya registrada en esta ciudad)',
      opt_cidade_esgotada: '{nome} (6/6 marcas - Agotado)',
      opt_cidade_parcial: '{nome} ({n}/6 marcas registradas)',
      label_nome_rep: '4. Nombre del Representante',
      placeholder_nome_rep: 'Ej: Lucas Ferreira',
      helper_cor_auto: 'Al escribir un representante registrado, su color se carga automáticamente.',
      label_cor_destaque: '5. Color de Destaque en el Mapa',
      title_cor_aleatoria: 'Generar color aleatorio',
      btn_salvar_rep: 'Guardar Representante',
      summary_estado: 'Estado Seleccionado:',
      summary_nenhum: 'Ninguno',
      summary_nenhum_selecionado: 'Ninguno seleccionado',
      summary_cidades_rep: 'Ciudades con Representante:',
      summary_cadastrada_one: '{n} registrada',
      summary_cadastrada_other: '{n} registradas',
      summary_cidade_cadastrada_one: '{n} ciudad registrada',
      summary_cidade_cadastrada_other: '{n} ciudades registradas',
      summary_cidades_disp: 'Ciudades Disponibles en el Estado:',
      summary_disponiveis: '{livres} de {total} disponibles',
      tip_label: 'Consejo:',
      tip_text: '¡Puedes hacer clic directamente en cualquier ciudad del mapa para seleccionarla de inmediato!',
      excel_lote_title: 'Importación de Marcas por Lote:',
      excel_step_1: 'Seleccione el Estado deseado.',
      excel_step_2: 'Descargue la plantilla (.xlsx) con las columnas de Municipio y Marca.',
      excel_step_3: 'Complete las filas (hasta 6 marcas por ciudad) y suba la plantilla abajo.',
      btn_baixar_modelo: 'Descargar Plantilla (.xlsx)',
      info_nenhum_estado: 'Ningún Estado seleccionado',
      info_estado_selecionado: 'Estado Seleccionado: {nome} ({sigla})',
      drop_click: 'Haga clic para seleccionar',
      drop_drag: ' o arrastre la plantilla',
      drop_support: 'Soporta archivos Excel (.xlsx, .xls)',
      excel_cols_title: 'Estándar de Columnas de la Plantilla (.xlsx):',
      excel_col_1: '• <strong>ID IBGE:</strong> Código oficial de 7 dígitos de la ciudad.',
      excel_col_2: '• <strong>Estado & Municipio:</strong> Nombres del estado y municipio.',
      excel_col_3: '• <strong>Marca:</strong> Marca 1 a 6 que atenderá la localidad.',
      excel_col_4: '• <strong>Representante & Color Hex:</strong> Nombre del profesional y color en el mapa.',
      map_camada: 'Capa:',
      map_camadas: 'Capas',
      map_satelite: 'Satélite',
      map_ajustes: 'Ajustes:',
      map_ajustes_card: 'Ajustes',
      map_divisoes: 'Divisiones',
      map_rotulos: 'Etiquetas',
      map_enquadrar: 'Encuadrar',
      map_tela_cheia: 'Pantalla Completa',
      map_sair: 'Salir',
      map_sair_tela_cheia: 'Salir de Pantalla Completa',
      legend_borda_estado: 'Borde Estado',
      legend_divisoes: 'Divisiones de Ciudades',
      legend_edicao: 'Edición',
      metric_municipios: 'Municipios:',
      metric_representantes: 'Representantes:',
      btn_baixar_pacote: 'Descargar Paquete (.zip)',
      export_step_1: 'Renderizando mapa vectorial ejecutivo...',
      export_step_2: 'Generando planilla Excel estandarizada...',
      export_step_3: 'Generando Informe Ejecutivo en PDF (2 páginas)...',
      export_step_4: 'Comprimiendo paquete .zip ejecutivo...',
      table_title: 'Municipios y Representantes',
      table_subtitle: 'Listado completo',
      table_count_one: '{n} ítem',
      table_count_other: '{n} ítems',
      table_search_placeholder: 'Filtrar por ciudad, marca o nombre...',
      th_num: 'Nº',
      th_cor: 'Color',
      th_estado: 'Estado',
      th_municipio: 'Municipio',
      th_marca: 'Marca',
      th_representante: 'Representante',
      th_acoes: 'Acciones',
      table_empty_no_items: 'Ningún municipio registrado todavía.',
      table_empty_no_results: 'No se encontraron registros para la búsqueda.',
      title_focar_mapa: 'Enfocar en el mapa',
      title_remover_registro: 'Eliminar registro',
      title_editar_rep: 'Editar nombre o color de {nome}',
      popup_marcas_count: '({n}/6 marcas)',
      popup_tip_edit: '💡 Haga clic en el lápiz o en el color para editar nombre y color del representante',
      modal_marcas_title: 'Personalizar Nombres de las 6 Marcas',
      modal_marcas_desc: 'Defina los nombres de las marcas de su operación. Estos cambios se reflejan en el mapa, la tabla y los informes exportados.',
      btn_salvar_nomes: 'Guardar Nombres',
      modal_sug_title: 'Sugerencia de Divisiones Territoriales',
      modal_sug_badge: 'En Desarrollo',
      modal_sug_intro: 'Estamos desarrollando un algoritmo de agrupación geográfica inteligente:',
      modal_sug_item1: '<strong>Agrupación por Proximidad:</strong> División en carteras de municipios vecinos para optimizar el tiempo de desplazamiento.',
      modal_sug_item2: '<strong>Balanceo Poblacional:</strong> Distribución equilibrada de ciudades por potencial poblacional.',
      btn_fechar: 'Cerrar',
      modal_ajuda_title: 'Guía Práctica de Uso',
      modal_ajuda_sub: 'Aprenda a operar el gestor territorial de principio a fin',
      ajuda_1_title: 'Selección del Estado y Divisiones Municipales',
      ajuda_1_desc: 'Seleccione un Estado en el menú. El mapa encuadra la región y traza las <strong>fronteras del Estado</strong> y todas las <strong>divisiones de ciudades</strong> en colores de alto contraste.',
      ajuda_2_title: 'Registro con 1 Clic Directo en el Mapa',
      ajuda_2_desc: 'Puede seleccionar ciudades desde el formulario o <strong>haciendo clic directamente sobre la ciudad en el mapa</strong>.',
      ajuda_3_title: 'Múltiples Marcas por Municipio',
      ajuda_3_desc: 'Cada municipio acepta hasta 6 marcas. Las ciudades con más de una marca muestran <strong>franjas diagonales</strong> con los colores correspondientes en el mapa.',
      ajuda_4_title: 'Exportación del Paquete (.zip)',
      ajuda_4_desc: 'El botón <strong>Descargar Paquete (.zip)</strong> captura todo el Estado encuadrado y genera:',
      ajuda_4_li1: '<strong>mapa_representantes.png:</strong> Foto del Estado en alta resolución.',
      ajuda_4_li2: '<strong>tabela_representantes.xlsx:</strong> Planilla con colores en ARGB.',
      ajuda_4_li3: '<strong>relatorio_representantes.pdf:</strong> PDF de 2 páginas (Página 1 con Mapa Coloreado y Página 2 con Leyenda Completa).',
      btn_fechar_guia: 'Cerrar Guía',
      modal_cor_title: 'Editar Representante',
      modal_cor_sub_default: 'Cambio de Nombre y Color',
      modal_cor_sub_atual: 'Actualmente: {nome}',
      modal_cor_label_nome: 'Nombre del Representante:',
      modal_cor_placeholder_nome: 'Ingrese el nombre del representante...',
      modal_cor_info_one: 'Este representante atiende {n} municipio. El nuevo nombre y color se aplicarán a todas las ocurrencias.',
      modal_cor_info_other: 'Este representante atiende {n} municipios. El nuevo nombre y color se aplicarán a todas las ocurrencias.',
      modal_cor_label_paleta: 'Color Institucional (1 Toque):',
      modal_cor_label_custom: 'O personalice con el color exacto:',
      btn_cancelar: 'Cancelar',
      btn_salvar_alteracoes: 'Guardar Cambios',
      footer_text: 'Gestor Territorial de Representantes • Datos geográficos provistos por IBGE • Memoria volátil (100% en memoria)',
      modal_prog_title: 'Procesando Importación',
      modal_prog_sub: 'Consultando mallas cartográficas en IBGE...',
      modal_prog_count: '{atual} de {total} municipios',
      modal_prog_note: 'Esto puede tardar unos segundos dependiendo de la cantidad de ciudades.',
      toast_marcas_ok: '¡Nombres de marcas actualizados con éxito!',
      toast_erro_estados: 'Error al cargar los estados del IBGE.',
      toast_erro_ibge_uf: 'Error al cargar datos del IBGE para el estado.',
      toast_erro_contorno: 'No fue posible obtener el contorno del municipio en IBGE.',
      toast_sel_estado: 'Seleccione un Estado.',
      toast_sel_municipio: 'Seleccione un Municipio o haga clic directamente en el mapa.',
      toast_sel_marca: 'Seleccione una Marca.',
      toast_digite_rep: 'Ingrese el nombre del Representante.',
      toast_marca_existe: '¡Esta marca ya está registrada para este municipio!',
      toast_limite_marcas: '¡Límite máximo de 6 marcas por municipio alcanzado!',
      toast_erro_malha: 'Error al obtener la malla del municipio en IBGE.',
      toast_nome_vazio: 'El nombre del representante no puede estar en blanco.',
      toast_rep_atualizado_one: '¡Representante actualizado a "{nome}" ({n} municipio en el mapa)!',
      toast_rep_atualizado_other: '¡Representante actualizado a "{nome}" ({n} municipios en el mapa)!',
      toast_sel_estado_modelo: 'Seleccione primero un Estado para generar la plantilla.',
      toast_aguarde_municipios: 'Espere a que se carguen los municipios.',
      toast_modelo_baixado: 'Plantilla descargada ({n} ciudades).',
      toast_arq_invalido: 'Seleccione un archivo Excel (.xlsx o .xls).',
      toast_planilha_vazia: 'No se encontraron filas con Representante e ID IBGE.',
      toast_erro_planilha: 'Error al leer la plantilla: ',
      toast_import_ok: '¡Importación completada! {add} agregados con éxito{err}.',
      toast_import_err_part: ', {erros} con error',
      toast_cadastre_antes: 'Registre al menos un municipio antes de exportar el paquete.',
      toast_pacote_ok: '¡Informe Ejecutivo generado con éxito (PDF Geomarketing + Mapa HD + Excel)!',
      toast_erro_pacote: 'Error al exportar paquete: '
    }
  };

  function t(key, params = {}) {
    const langDict = dictionary[currentLang] || dictionary.pt;
    let str = langDict[key] !== undefined ? langDict[key] : (dictionary.pt[key] || key);
    Object.keys(params).forEach(k => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
    });
    return str;
  }

  function init() {
    // 1. Inicializar Tema (Preferência salva ou preferência do SO, padrão Dark Sentinel)
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      currentTheme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      currentTheme = 'light';
    } else {
      currentTheme = 'dark';
    }
    applyTheme(currentTheme);

    // Ouvir mudanças de preferência do SO caso o usuário não tenha fixado manualmente
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_THEME_KEY)) {
          setTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }

    // 2. Inicializar Idioma
    const savedLang = localStorage.getItem(STORAGE_LANG_KEY);
    if (savedLang && dictionary[savedLang]) {
      currentLang = savedLang;
    } else {
      currentLang = 'pt';
    }
    applyTranslations();
    bindControlEvents();
  }

  function applyTheme(theme) {
    currentTheme = theme;
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.add('light');
      html.classList.remove('dark');
    }

    const sunIcon = document.getElementById('themeIconSun');
    const moonIcon = document.getElementById('themeIconMoon');
    if (sunIcon && moonIcon) {
      if (theme === 'dark') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      }
    }
  }

  function setTheme(theme, persist = true) {
    applyTheme(theme);
    if (persist) {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    }
  }

  function toggleTheme() {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
  }

  function setLanguage(lang) {
    if (!dictionary[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_LANG_KEY, lang);
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : (lang === 'es' ? 'es' : 'en');
    applyTranslations();
    if (window.App && typeof window.App.onLanguageChanged === 'function') {
      window.App.onLanguageChanged();
    }
  }

  function applyTranslations() {
    document.title = t('page_title');

    // Elementos com data-i18n (textContent)
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    // Elementos com data-i18n-html (innerHTML)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });

    // Titles / Tooltips
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });

    // Atualizar botão de idioma ativo na pílula do Header
    const flagContainer = document.getElementById('currentLangFlag');
    const codeContainer = document.getElementById('currentLangCode');
    if (flagContainer) flagContainer.innerHTML = FLAGS[currentLang] || FLAGS.pt;
    if (codeContainer) codeContainer.textContent = LANG_LABELS[currentLang] || 'PT';

    // Destacar item ativo no dropdown de idiomas
    document.querySelectorAll('.lang-option-btn').forEach(btn => {
      const bLang = btn.getAttribute('data-lang');
      if (bLang === currentLang) {
        btn.classList.add('lang-option-active');
      } else {
        btn.classList.remove('lang-option-active');
      }
    });
  }

  function bindControlEvents() {
    const btnTheme = document.getElementById('btnThemeToggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        toggleTheme();
      });
    }

    const btnLang = document.getElementById('btnLangToggle');
    const menuLang = document.getElementById('langDropdownMenu');
    if (btnLang && menuLang) {
      btnLang.addEventListener('click', (e) => {
        e.stopPropagation();
        menuLang.classList.toggle('hidden');
      });

      document.querySelectorAll('.lang-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chosen = btn.getAttribute('data-lang');
          setLanguage(chosen);
          menuLang.classList.add('hidden');
        });
      });

      document.addEventListener('click', (e) => {
        if (!menuLang.contains(e.target) && !btnLang.contains(e.target)) {
          menuLang.classList.add('hidden');
        }
      });
    }
  }

  return {
    init,
    t,
    setTheme,
    toggleTheme,
    getTheme: () => currentTheme,
    setLanguage,
    getLanguage: () => currentLang,
    applyTranslations
  };
})();

window.I18nManager = I18nManager;
