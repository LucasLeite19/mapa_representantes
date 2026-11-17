/**
 * MÓDULO PRINCIPAL: APP CONTROLLER
 * Coordena interface, eventos, regras de negócio e sincronização entre mapa e tabela.
 * Suporta exportação com foto enquadrada no Estado selecionado, geração de PDF de 2 folhas (Mapa + Legenda/Resumo)
 * e barra de navegação corporativa centralizada com 4 ações principais.
 */

const App = (() => {
  const state = {
    estados: [],
    municipiosAtuais: [],
    estadoSelecionado: null,
    estadoBounds: null,
    marcas: [
      { id: 1, nome: 'Marca 1' },
      { id: 2, nome: 'Marca 2' },
      { id: 3, nome: 'Marca 3' },
      { id: 4, nome: 'Marca 4' },
      { id: 5, nome: 'Marca 5' },
      { id: 6, nome: 'Marca 6' }
    ],
    itensCadastrados: [],
    nextSeqId: 1,
    previewGeoJson: null,
    isExporting: false,
    abaAtiva: 'manual'
  };

  function t(key, params = {}) {
    return (window.I18nManager && window.I18nManager.t) ? window.I18nManager.t(key, params) : key;
  }

  function persistState() {
    if (window.StorageManager) {
      window.StorageManager.scheduleSave(state);
    }
  }

  /**
   * Inicialização do Sistema
   */
  async function init() {
    if (window.I18nManager) {
      window.I18nManager.init();
    }
    MapManager.init();
    bindEvents();
    renderSelectMarcas();
    setCorAtual(getRandomColor());
    await carregarEstados();
    await restaurarTrabalhoSalvo();
    renderTabela();
    atualizarMetricas();
    atualizarResumoLateral();
  }

  /**
   * Restaura automaticamente o último trabalho salvo no IndexedDB local
   */
  async function restaurarTrabalhoSalvo() {
    if (!window.StorageManager) return;

    try {
      const saved = await window.StorageManager.loadWorkspace();
      if (!saved) return;

      if (Array.isArray(saved.marcas) && saved.marcas.length === 6) {
        state.marcas = saved.marcas;
      }

      if (typeof saved.nextSeqId === 'number' && saved.nextSeqId >= 1) {
        state.nextSeqId = saved.nextSeqId;
      }

      if (saved.estadoSelecionadoId) {
        const selectEstado = document.getElementById('selectEstado');
        if (selectEstado) {
          selectEstado.value = String(saved.estadoSelecionadoId);
        }
        await onEstadoChange(saved.estadoSelecionadoId, true);
      }

      if (Array.isArray(saved.itensCadastrados) && saved.itensCadastrados.length > 0) {
        state.itensCadastrados = saved.itensCadastrados;

        // Se algum item salvo não tiver geoJson embutido, busca na malha local
        const cidadesUnicas = new Set(state.itensCadastrados.map(it => String(it.municipioId)));
        for (const mId of cidadesUnicas) {
          const itensDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
          let geoJson = itensDaCidade[0] ? itensDaCidade[0].geoJson : null;
          if (!geoJson) {
            try {
              geoJson = await IBGEService.getMalhaMunicipio(mId);
              itensDaCidade.forEach(it => { it.geoJson = geoJson; });
            } catch (e) {
              console.warn('Não foi possível restaurar geometria do município', mId, e);
            }
          }
          if (geoJson) {
            MapManager.syncMunicipalityLayer(mId, geoJson, itensDaCidade);
          }
        }

        atualizarSelectMunicipios();
        renderTabela();
        atualizarMetricas();
        atualizarResumoLateral();
        showToast(t('toast_trabalho_restaurado', { n: state.itensCadastrados.length }), 'info');
      }
    } catch (err) {
      console.warn('Falha ao restaurar trabalho salvo:', err);
    }
  }

  /**
   * Limpa todos os dados salvos no IndexedDB e reinicia a área de trabalho
   */
  async function limparTrabalhoCompleto() {
    const cidadesAntigas = new Set(state.itensCadastrados.map(it => String(it.municipioId)));
    cidadesAntigas.forEach(mId => {
      MapManager.removeMunicipality(mId, []);
    });

    MapManager.clearPreview();
    MapManager.clearStateHighlight();
    MapManager.resetToBrasil();

    state.itensCadastrados = [];
    state.nextSeqId = 1;
    state.estadoSelecionado = null;
    state.municipiosAtuais = [];
    state.estadoBounds = null;
    state.previewGeoJson = null;
    state.malhaEstado = null;
    state.malhaMunicipios = null;
    state.marcas = [
      { id: 1, nome: 'Marca 1' },
      { id: 2, nome: 'Marca 2' },
      { id: 3, nome: 'Marca 3' },
      { id: 4, nome: 'Marca 4' },
      { id: 5, nome: 'Marca 5' },
      { id: 6, nome: 'Marca 6' }
    ];

    const selectEstado = document.getElementById('selectEstado');
    if (selectEstado) selectEstado.value = '';

    const selectMunicipio = document.getElementById('selectMunicipio');
    if (selectMunicipio) {
      selectMunicipio.innerHTML = `<option value="">${t('opt_selecione_estado_primeiro')}</option>`;
      selectMunicipio.disabled = true;
    }

    const labelTotal = document.getElementById('labelTotalMunicipios');
    if (labelTotal) labelTotal.textContent = '';

    const infoModelo = document.getElementById('infoModeloEstado');
    if (infoModelo) infoModelo.textContent = t('info_nenhum_estado');

    renderSelectMarcas(null);
    renderTabela();
    atualizarMetricas();
    atualizarResumoLateral();

    if (window.StorageManager) {
      await window.StorageManager.clearWorkspace();
    }

    const modalLimpar = document.getElementById('modalLimparDados');
    if (modalLimpar) modalLimpar.classList.add('hidden');

    showToast(t('toast_dados_limpos'), 'info');
  }

  function onLanguageChanged() {
    setAbaAtiva(state.abaAtiva || 'manual');
    if (window.StorageManager && typeof window.StorageManager.refreshStatusText === 'function') {
      window.StorageManager.refreshStatusText();
    }

    // Atualiza o primeiro item de selectEstado
    const selectEstado = document.getElementById('selectEstado');
    if (selectEstado && selectEstado.options.length > 0 && selectEstado.options[0].value === '') {
      selectEstado.options[0].textContent = t('opt_selecione_estado');
    }

    // Atualiza o selectMunicipio e labels
    const selectMunicipio = document.getElementById('selectMunicipio');
    const labelTotal = document.getElementById('labelTotalMunicipios');
    const infoModelo = document.getElementById('infoModeloEstado');

    if (!state.estadoSelecionado) {
      if (selectMunicipio) {
        selectMunicipio.innerHTML = `<option value="">${t('opt_selecione_estado_primeiro')}</option>`;
      }
      if (infoModelo) infoModelo.textContent = t('info_nenhum_estado');
      if (labelTotal) labelTotal.textContent = '';
    } else {
      if (infoModelo) {
        infoModelo.textContent = t('info_estado_selecionado', {
          nome: state.estadoSelecionado.nome,
          sigla: state.estadoSelecionado.sigla
        });
      }
      if (labelTotal && state.municipiosAtuais) {
        labelTotal.textContent = t('label_qtd_municipios', { n: state.municipiosAtuais.length });
      }
      atualizarSelectMunicipios();
    }

    renderSelectMarcas(selectMunicipio ? selectMunicipio.value : null);
    renderTabela();
    atualizarResumoLateral();

    // Atualiza popups das cidades cadastradas no mapa
    const cidadesUnicas = new Set(state.itensCadastrados.map(it => String(it.municipioId)));
    cidadesUnicas.forEach(mId => {
      const itensDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
      MapManager.syncMunicipalityLayer(mId, null, itensDaCidade);
    });
  }

  /**
   * Renderiza as opções do <select id="selectMarca">
   */
  function renderSelectMarcas(municipioId = null) {
    const select = document.getElementById('selectMarca');
    if (!select) return;

    select.innerHTML = '';

    const marcasOcupadas = new Set();
    if (municipioId) {
      state.itensCadastrados
        .filter(it => String(it.municipioId) === String(municipioId))
        .forEach(it => marcasOcupadas.add(Number(it.marcaId)));
    }

    state.marcas.forEach(marca => {
      const opt = document.createElement('option');
      opt.value = marca.id;
      opt.dataset.nome = marca.nome;

      if (marcasOcupadas.has(marca.id)) {
        opt.disabled = true;
        opt.textContent = t('opt_marca_ocupada', { nome: marca.nome });
      } else {
        opt.textContent = marca.nome;
      }
      select.appendChild(opt);
    });

    const primeiraDisponivel = Array.from(select.options).find(opt => !opt.disabled);
    if (primeiraDisponivel) {
      select.value = primeiraDisponivel.value;
    }
  }

  /**
   * Alterna entre modo manual e modo importar excel
   */
  function setAbaAtiva(modo) {
    state.abaAtiva = modo;
    const contentManual = document.getElementById('contentManual');
    const contentMassa = document.getElementById('contentMassa');
    const navBtnManual = document.getElementById('navBtnManual');
    const navBtnExcel = document.getElementById('navBtnExcel');
    const cardHeaderTitle = document.getElementById('cardHeaderTitle');

    const activeClasses = 'px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all nav-btn-active';
    const inactiveClasses = 'px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all nav-btn-inactive';

    if (modo === 'manual') {
      if (contentManual) contentManual.classList.remove('hidden');
      if (contentMassa) contentMassa.classList.add('hidden');
      if (cardHeaderTitle) {
        cardHeaderTitle.setAttribute('data-i18n', 'card_title_manual');
        cardHeaderTitle.textContent = t('card_title_manual');
      }

      if (navBtnManual) navBtnManual.className = activeClasses;
      if (navBtnExcel) navBtnExcel.className = inactiveClasses;
    } else {
      if (contentMassa) contentMassa.classList.remove('hidden');
      if (contentManual) contentManual.classList.add('hidden');
      if (cardHeaderTitle) {
        cardHeaderTitle.setAttribute('data-i18n', 'card_title_massa');
        cardHeaderTitle.textContent = t('card_title_massa');
      }

      if (navBtnExcel) navBtnExcel.className = activeClasses;
      if (navBtnManual) navBtnManual.className = inactiveClasses;
    }
  }

  /**
   * Vinculação de Eventos da Interface
   */
  function bindEvents() {
    // 4 Botões Centrais da Sub-Barra de Navegação
    const navBtnManual = document.getElementById('navBtnManual');
    const navBtnExcel = document.getElementById('navBtnExcel');
    const navBtnSugestoes = document.getElementById('navBtnSugestoes');
    const navBtnAjuda = document.getElementById('navBtnAjuda');

    if (navBtnManual) {
      navBtnManual.addEventListener('click', () => setAbaAtiva('manual'));
    }
    if (navBtnExcel) {
      navBtnExcel.addEventListener('click', () => setAbaAtiva('massa'));
    }
    if (navBtnSugestoes) {
      navBtnSugestoes.addEventListener('click', () => {
        const modal = document.getElementById('modalSugestoes');
        if (modal) modal.classList.remove('hidden');
      });
    }
    if (navBtnAjuda) {
      navBtnAjuda.addEventListener('click', () => {
        const modal = document.getElementById('modalAjuda');
        if (modal) modal.classList.remove('hidden');
      });
    }

    // Fechar modais de Sugestão e Ajuda
    const btnFecharSugestoes = document.getElementById('btnFecharModalSugestoes');
    if (btnFecharSugestoes) {
      btnFecharSugestoes.addEventListener('click', () => {
        document.getElementById('modalSugestoes').classList.add('hidden');
      });
    }
    const btnFecharAjuda = document.getElementById('btnFecharModalAjuda');
    if (btnFecharAjuda) {
      btnFecharAjuda.addEventListener('click', () => {
        document.getElementById('modalAjuda').classList.add('hidden');
      });
    }

    // Seletor de Estados
    document.getElementById('selectEstado').addEventListener('change', (e) => {
      onEstadoChange(e.target.value);
    });

    // Seletor de Municípios
    document.getElementById('selectMunicipio').addEventListener('change', (e) => {
      onMunicipioChange(e.target.value);
    });

    // Checkbox de divisões municipais (Barra principal e Tela Cheia)
    const checkDivisoes = document.getElementById('checkDivisoesCidades');
    const checkDivisoesFull = document.getElementById('checkDivisoesFullscreen');
    if (checkDivisoes) {
      checkDivisoes.addEventListener('change', (e) => {
        if (checkDivisoesFull) checkDivisoesFull.checked = e.target.checked;
        MapManager.toggleMunicipalDivisions(e.target.checked);
      });
    }
    if (checkDivisoesFull) {
      checkDivisoesFull.addEventListener('change', (e) => {
        if (checkDivisoes) checkDivisoes.checked = e.target.checked;
        MapManager.toggleMunicipalDivisions(e.target.checked);
      });
    }

    // Checkbox de Rótulos no Mapa (Barra principal e Tela Cheia)
    const checkRotulos = document.getElementById('checkRotulosMapa');
    const checkRotulosFull = document.getElementById('checkRotulosFullscreen');
    if (checkRotulos) {
      checkRotulos.addEventListener('change', (e) => {
        const val = e.target.checked;
        if (checkRotulosFull) checkRotulosFull.checked = val;
        MapManager.toggleTooltips(val);
      });
    }
    if (checkRotulosFull) {
      checkRotulosFull.addEventListener('change', (e) => {
        const val = e.target.checked;
        if (checkRotulos) checkRotulos.checked = val;
        MapManager.toggleTooltips(val);
      });
    }

    // Campo de Representante: auto preenche cor existente
    const inputRep = document.getElementById('inputRepresentante');
    inputRep.addEventListener('input', () => {
      const nomeDigitado = inputRep.value.trim().toLowerCase();
      if (!nomeDigitado) return;

      const existente = state.itensCadastrados.find(
        it => it.representante.trim().toLowerCase() === nomeDigitado
      );
      if (existente) {
        setCorAtual(existente.cor);
      }
    });

    // Color Picker & Hex Input
    const inputCor = document.getElementById('inputCor');
    const inputCorHex = document.getElementById('inputCorHex');
    const btnCorAleatoria = document.getElementById('btnCorAleatoria');

    inputCor.addEventListener('input', (e) => {
      inputCorHex.value = e.target.value.toUpperCase();
    });

    inputCorHex.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        inputCor.value = val;
      }
    });

    btnCorAleatoria.addEventListener('click', () => {
      setCorAtual(getRandomColor());
    });

    // Botão Salvar Representante (Manual)
    document.getElementById('btnSalvarRepresentante').addEventListener('click', salvarRepresentanteManual);

    // Botões de Camadas de Fundo do Mapa
    document.querySelectorAll('.btn-tile-layer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        MapManager.setTileProvider(e.currentTarget.dataset.layer);
      });
    });

    // Botão Enquadrar (Reset Zoom) - Principal e Tela Cheia
    const handleResetZoom = () => {
      if (state.estadoBounds) {
        MapManager.fitToBounds(state.estadoBounds);
      } else if (state.itensCadastrados.length > 0) {
        MapManager.fitAllRegisteredCities();
      } else {
        MapManager.resetToBrasil();
      }
    };
    document.getElementById('btnResetZoom').addEventListener('click', handleResetZoom);
    const btnResetZoomFull = document.getElementById('btnResetZoomFullscreen');
    if (btnResetZoomFull) {
      btnResetZoomFull.addEventListener('click', handleResetZoom);
    }

    // Botão Tela Cheia (Alternância e Botão Flutuante de Sair)
    document.getElementById('btnFullScreen').addEventListener('click', () => {
      MapManager.toggleFullScreen();
    });
    const btnExitFull = document.getElementById('btnExitFullScreenFloating');
    if (btnExitFull) {
      btnExitFull.addEventListener('click', () => {
        MapManager.toggleFullScreen();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const wrapper = document.getElementById('mapWrapper');
        if (wrapper && wrapper.classList.contains('map-fullscreen')) {
          MapManager.toggleFullScreen();
        }
        document.querySelectorAll('#modalSugestoes, #modalAjuda, #modalMarcas, #modalAlterarCor').forEach(m => m.classList.add('hidden'));
      }
    });

    // Busca Rápida na Tabela
    document.getElementById('inputBuscaTabela').addEventListener('input', renderTabela);

    // Modal de Alteração de Cor do Representante (Design Não-Sensível e Seguro)
    document.getElementById('btnFecharModalCor').addEventListener('click', fecharModalAlterarCor);
    document.getElementById('btnCancelarModalCor').addEventListener('click', fecharModalAlterarCor);

    const inputModalCor = document.getElementById('inputModalCor');
    const inputModalHex = document.getElementById('inputModalCorHex');
    const badgePreview = document.getElementById('modalCorPreviewBadge');

    inputModalCor.addEventListener('input', (e) => {
      const val = e.target.value.toUpperCase();
      inputModalHex.value = val;
      badgePreview.style.backgroundColor = val;
    });

    inputModalHex.addEventListener('input', (e) => {
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        inputModalCor.value = val;
        badgePreview.style.backgroundColor = val;
      }
    });

    document.getElementById('btnModalCorAleatoria').addEventListener('click', () => {
      const nova = getRandomColor();
      inputModalCor.value = nova;
      inputModalHex.value = nova;
      badgePreview.style.backgroundColor = nova;
    });

    document.getElementById('btnSalvarModalCor').addEventListener('click', () => {
      if (!repSelecionadoParaCor) return;
      const inputNome = document.getElementById('inputModalNomeRep');
      const novoNome = inputNome ? inputNome.value.trim() : repSelecionadoParaCor;

      if (!novoNome) {
        showToast(t('toast_nome_vazio'), 'warning');
        if (inputNome) inputNome.focus();
        return;
      }

      const corFinal = inputModalCor.value.toUpperCase();
      atualizarRepresentanteCompleto(repSelecionadoParaCor, novoNome, corFinal);
      fecharModalAlterarCor();
    });

    const inputModalNome = document.getElementById('inputModalNomeRep');
    if (inputModalNome) {
      inputModalNome.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('btnSalvarModalCor').click();
        }
      });
    }

    // Delegar cliques para abrir o modal de cor a partir do Mapa ou da Tabela
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-abrir-modal-cor');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const repName = btn.dataset.rep;
        const cor = btn.dataset.cor;
        abrirModalAlterarCor(repName, cor);
      }
    });

    // Padronização do título da aba do navegador (mantém sempre o nome oficial limpo)
    document.title = t('page_title');

    // Aviso inteligente ao sair: apenas se houver alterações pendentes ainda não gravadas no IndexedDB
    window.addEventListener('beforeunload', (e) => {
      if (window.StorageManager && window.StorageManager.hasUnsavedChanges()) {
        window.StorageManager.flushPendingSave();
        e.preventDefault();
        e.returnValue = 'Existem alterações pendentes de salvamento.';
        return e.returnValue;
      }
    });

    // Importação em Massa: Baixar Modelo
    document.getElementById('btnBaixarModelo').addEventListener('click', baixarPlanilhaModelo);

    // Importação em Massa: Upload de Arquivo
    const inputFile = document.getElementById('inputFilePlanilha');
    const dropZone = document.getElementById('dropZonePlanilha');

    dropZone.addEventListener('click', () => inputFile.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-600', 'bg-indigo-50');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-indigo-600', 'bg-indigo-50');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-600', 'bg-indigo-50');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processarPlanilhaUpload(e.dataTransfer.files[0]);
      }
    });

    inputFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processarPlanilhaUpload(e.target.files[0]);
        inputFile.value = '';
      }
    });

    // 4 Botões Independentes de Exportação (Imagem, PDF, Excel, Pacote .ZIP)
    const btnImg = document.getElementById('btnBaixarImagem');
    const btnPdf = document.getElementById('btnBaixarPdf');
    const btnExcel = document.getElementById('btnBaixarExcel');
    const btnZip = document.getElementById('btnBaixarPacote');

    if (btnImg) btnImg.addEventListener('click', baixarApenasImagem);
    if (btnPdf) btnPdf.addEventListener('click', baixarApenasPdf);
    if (btnExcel) btnExcel.addEventListener('click', baixarApenasExcel);
    if (btnZip) btnZip.addEventListener('click', baixarPacoteFinal);

    // Botão e Modal de Limpar Dados Salvos (Novo Trabalho)
    const btnLimpar = document.getElementById('btnLimparDados');
    const modalLimpar = document.getElementById('modalLimparDados');
    const btnFecharLimpar = document.getElementById('btnFecharModalLimpar');
    const btnCancelarLimpar = document.getElementById('btnCancelarModalLimpar');
    const btnConfirmarLimpar = document.getElementById('btnConfirmarLimparDados');

    if (btnLimpar && modalLimpar) {
      btnLimpar.addEventListener('click', () => {
        modalLimpar.classList.remove('hidden');
      });
    }
    if (btnFecharLimpar && modalLimpar) {
      btnFecharLimpar.addEventListener('click', () => modalLimpar.classList.add('hidden'));
    }
    if (btnCancelarLimpar && modalLimpar) {
      btnCancelarLimpar.addEventListener('click', () => modalLimpar.classList.add('hidden'));
    }
    if (btnConfirmarLimpar) {
      btnConfirmarLimpar.addEventListener('click', limparTrabalhoCompleto);
    }

    // Modal de Gerenciar Nomes das Marcas
    const btnGerenciarMarcas = document.getElementById('btnGerenciarMarcas');
    const modalMarcas = document.getElementById('modalMarcas');
    const btnFecharModalMarcas = document.getElementById('btnFecharModalMarcas');
    const btnSalvarNomesMarcas = document.getElementById('btnSalvarNomesMarcas');

    if (btnGerenciarMarcas && modalMarcas) {
      btnGerenciarMarcas.addEventListener('click', () => {
        state.marcas.forEach(m => {
          const inp = document.getElementById(`inputNomeMarca${m.id}`);
          if (inp) inp.value = m.nome;
        });
        modalMarcas.classList.remove('hidden');
      });

      btnFecharModalMarcas.addEventListener('click', () => {
        modalMarcas.classList.add('hidden');
      });

      btnSalvarNomesMarcas.addEventListener('click', () => {
        state.marcas.forEach(m => {
          const inp = document.getElementById(`inputNomeMarca${m.id}`);
          if (inp && inp.value.trim()) {
            m.nome = inp.value.trim();
          }
        });

        state.itensCadastrados.forEach(it => {
          const marcaObj = state.marcas.find(m => m.id === Number(it.marcaId));
          if (marcaObj) it.marcaNome = marcaObj.nome;
        });

        const cidadesUnicas = new Set(state.itensCadastrados.map(it => String(it.municipioId)));
        cidadesUnicas.forEach(mId => {
          const itensDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
          MapManager.syncMunicipalityLayer(mId, null, itensDaCidade);
        });

        const selectMun = document.getElementById('selectMunicipio');
        renderSelectMarcas(selectMun ? selectMun.value : null);
        renderTabela();
        persistState();
        modalMarcas.classList.add('hidden');
        showToast(t('toast_marcas_ok'), 'success');
      });
    }
  }

  /**
   * Carrega os Estados da Federação via IBGEService
   */
  async function carregarEstados() {
    const select = document.getElementById('selectEstado');
    try {
      const estados = await IBGEService.getEstados();
      state.estados = estados;

      select.innerHTML = `<option value="">${t('opt_selecione_estado')}</option>`;
      estados.forEach(uf => {
        const opt = document.createElement('option');
        opt.value = uf.id;
        opt.dataset.sigla = uf.sigla;
        opt.dataset.nome = uf.nome;
        opt.textContent = `${uf.nome} (${uf.sigla})`;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      select.innerHTML = `<option value="">${t('opt_erro_estados')}</option>`;
      showToast(t('toast_erro_estados'), 'error');
    }
  }

  /**
   * Ação ao trocar o Estado selecionado
   */
  async function onEstadoChange(estadoId, skipSave = false) {
    const selectMunicipio = document.getElementById('selectMunicipio');
    const labelTotal = document.getElementById('labelTotalMunicipios');
    const infoModelo = document.getElementById('infoModeloEstado');

    MapManager.clearPreview();
    MapManager.clearStateHighlight();
    state.previewGeoJson = null;

    if (!estadoId) {
      state.estadoSelecionado = null;
      state.municipiosAtuais = [];
      state.estadoBounds = null;
      selectMunicipio.innerHTML = `<option value="">${t('opt_selecione_estado_primeiro')}</option>`;
      selectMunicipio.disabled = true;
      labelTotal.textContent = '';
      infoModelo.textContent = t('info_nenhum_estado');
      MapManager.resetToBrasil();
      renderSelectMarcas(null);
      atualizarResumoLateral();
      if (!skipSave) persistState();
      return;
    }

    const uf = state.estados.find(e => String(e.id) === String(estadoId));
    if (!uf) return;
    state.estadoSelecionado = uf;
    infoModelo.textContent = t('info_estado_selecionado', { nome: uf.nome, sigla: uf.sigla });
    if (!skipSave) persistState();

    const bounds = IBGEService.getEstadoBounds(uf.sigla);
    if (bounds) {
      state.estadoBounds = bounds;
      MapManager.fitToBounds(bounds);
    }

    selectMunicipio.disabled = true;
    selectMunicipio.innerHTML = `<option value="">${t('opt_carregando_municipios')}</option>`;
    labelTotal.textContent = t('label_carregando_malhas');

    try {
      const municipios = await IBGEService.getMunicipios(uf.id);
      state.municipiosAtuais = municipios;
      atualizarSelectMunicipios();
      labelTotal.textContent = t('label_qtd_municipios', { n: municipios.length });

      const municipiosMap = new Map();
      municipios.forEach(m => municipiosMap.set(String(m.id), m.nome));

      const [malhaEstado, malhaMunicipios] = await Promise.all([
        IBGEService.getMalhaEstado(uf.sigla).catch(e => {
          console.warn('Falha contorno estado:', e);
          return null;
        }),
        IBGEService.getMalhaMunicipiosEstado(uf.sigla).catch(e => {
          console.warn('Falha divisão municípios:', e);
          return null;
        })
      ]);

      state.malhaEstado = malhaEstado;
      state.malhaMunicipios = malhaMunicipios;

      MapManager.setStateHighlight(malhaEstado, malhaMunicipios, municipiosMap, (clickedMunicipioId) => {
        if (selectMunicipio && clickedMunicipioId) {
          selectMunicipio.value = clickedMunicipioId;
          onMunicipioChange(clickedMunicipioId);
        }
      });

    } catch (err) {
      console.error(err);
      selectMunicipio.innerHTML = `<option value="">${t('opt_erro_municipios')}</option>`;
      showToast(t('toast_erro_ibge_uf'), 'error');
    } finally {
      selectMunicipio.disabled = false;
    }
  }

  function atualizarSelectMunicipios() {
    const select = document.getElementById('selectMunicipio');
    const valorAnterior = select.value;
    select.innerHTML = `<option value="">${t('opt_selecione_municipio')}</option>`;

    const contagemPorCidade = new Map();
    state.itensCadastrados.forEach(it => {
      const key = String(it.municipioId);
      contagemPorCidade.set(key, (contagemPorCidade.get(key) || 0) + 1);
    });

    state.municipiosAtuais.forEach(m => {
      const opt = document.createElement('option');
      const mId = String(m.id);
      opt.value = m.id;
      opt.dataset.nome = m.nome;

      const qtdMarcas = contagemPorCidade.get(mId) || 0;
      if (qtdMarcas >= 6) {
        opt.disabled = true;
        opt.textContent = t('opt_cidade_esgotada', { nome: m.nome });
      } else if (qtdMarcas > 0) {
        opt.textContent = t('opt_cidade_parcial', { nome: m.nome, n: qtdMarcas });
      } else {
        opt.textContent = m.nome;
      }
      select.appendChild(opt);
    });

    if (valorAnterior && (contagemPorCidade.get(String(valorAnterior)) || 0) < 6) {
      select.value = valorAnterior;
    }

    renderSelectMarcas(select.value);
    atualizarResumoLateral();
  }

  /**
   * Atualiza as informações do rodapé do card lateral com o resumo territorial
   */
  function atualizarResumoLateral() {
    const cardEstadoAtivo = document.getElementById('cardEstadoAtivo');
    const cardCidadesAtivas = document.getElementById('cardCidadesAtivas');
    const cardCidadesDisponiveis = document.getElementById('cardCidadesDisponiveis');

    if (!cardEstadoAtivo) return;

    if (state.estadoSelecionado) {
      cardEstadoAtivo.textContent = `${state.estadoSelecionado.nome} (${state.estadoSelecionado.sigla})`;
      const totalDoEstado = state.municipiosAtuais ? state.municipiosAtuais.length : 0;
      const cadastradasNoEstado = new Set(
        state.itensCadastrados
          .filter(it => it.estadoSigla === state.estadoSelecionado.sigla)
          .map(it => String(it.municipioId))
      ).size;

      if (cardCidadesAtivas) {
        cardCidadesAtivas.textContent = t(cadastradasNoEstado === 1 ? 'summary_cadastrada_one' : 'summary_cadastrada_other', { n: cadastradasNoEstado });
      }
      if (cardCidadesDisponiveis) {
        const livres = Math.max(0, totalDoEstado - cadastradasNoEstado);
        cardCidadesDisponiveis.textContent = totalDoEstado > 0 ? t('summary_disponiveis', { livres, total: totalDoEstado }) : '-';
      }
    } else {
      cardEstadoAtivo.textContent = t('summary_nenhum_selecionado');
      if (cardCidadesAtivas) {
        const total = new Set(state.itensCadastrados.map(it => String(it.municipioId))).size;
        cardCidadesAtivas.textContent = t(total === 1 ? 'summary_cidade_cadastrada_one' : 'summary_cidade_cadastrada_other', { n: total });
      }
      if (cardCidadesDisponiveis) {
        cardCidadesDisponiveis.textContent = '-';
      }
    }
  }

  async function onMunicipioChange(municipioId) {
    MapManager.clearPreview();
    state.previewGeoJson = null;

    renderSelectMarcas(municipioId);

    const helper = document.getElementById('helperMunicipio');
    if (!municipioId) {
      helper.classList.add('hidden');
      return;
    }

    helper.classList.remove('hidden');

    try {
      let geoJson = null;
      if (state.malhaMunicipios && Array.isArray(state.malhaMunicipios.features)) {
        geoJson = state.malhaMunicipios.features.find(f => 
          String(f.id) === String(municipioId) ||
          (f.properties && String(f.properties.codarea) === String(municipioId))
        );
      }
      if (!geoJson) {
        geoJson = await IBGEService.getMalhaMunicipio(municipioId);
      }
      state.previewGeoJson = geoJson;
      MapManager.showPreview(geoJson);
    } catch (err) {
      console.error(err);
      showToast(t('toast_erro_contorno'), 'warning');
    } finally {
      helper.classList.add('hidden');
    }
  }

  async function salvarRepresentanteManual() {
    const selectEstado = document.getElementById('selectEstado');
    const selectMunicipio = document.getElementById('selectMunicipio');
    const selectMarca = document.getElementById('selectMarca');
    const inputRep = document.getElementById('inputRepresentante');
    const inputCor = document.getElementById('inputCor');

    const estadoId = selectEstado.value;
    const municipioId = selectMunicipio.value;
    const marcaId = Number(selectMarca.value);
    const nome = inputRep.value.trim();
    const cor = inputCor.value.toUpperCase();

    if (!estadoId) {
      showToast(t('toast_sel_estado'), 'warning');
      return;
    }
    if (!municipioId) {
      showToast(t('toast_sel_municipio'), 'warning');
      return;
    }
    if (!marcaId) {
      showToast(t('toast_sel_marca'), 'warning');
      return;
    }
    if (!nome) {
      showToast(t('toast_digite_rep'), 'warning');
      inputRep.focus();
      return;
    }

    const marcaJaExiste = state.itensCadastrados.some(
      it => String(it.municipioId) === String(municipioId) && Number(it.marcaId) === marcaId
    );
    if (marcaJaExiste) {
      showToast(t('toast_marca_existe'), 'warning');
      return;
    }

    const totalNestaCidade = state.itensCadastrados.filter(
      it => String(it.municipioId) === String(municipioId)
    ).length;
    if (totalNestaCidade >= 6) {
      showToast(t('toast_limite_marcas'), 'warning');
      return;
    }

    const optUf = selectEstado.options[selectEstado.selectedIndex];
    const optMun = selectMunicipio.options[selectMunicipio.selectedIndex];
    const optMarca = selectMarca.options[selectMarca.selectedIndex];
    const municipioNome = optMun.dataset.nome || optMun.textContent.split(' (')[0].trim();
    const marcaNome = optMarca.dataset.nome || optMarca.textContent.split(' (')[0].trim();

    let geoJson = state.previewGeoJson;
    if (!geoJson && state.malhaMunicipios && Array.isArray(state.malhaMunicipios.features)) {
      geoJson = state.malhaMunicipios.features.find(f => 
        String(f.id) === String(municipioId) ||
        (f.properties && String(f.properties.codarea) === String(municipioId))
      );
    }
    if (!geoJson) {
      try {
        geoJson = await IBGEService.getMalhaMunicipio(municipioId);
      } catch (e) {
        showToast(t('toast_erro_malha'), 'error');
        return;
      }
    }

    MapManager.clearPreview();
    state.previewGeoJson = null;

    sincronizarCorRepresentante(nome, cor);

    const seqId = state.nextSeqId++;
    const item = {
      id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      seqId: seqId,
      estadoId: optUf.value,
      estadoSigla: optUf.dataset.sigla,
      estadoNome: optUf.dataset.nome,
      municipioId: municipioId,
      municipioNome: municipioNome,
      marcaId: marcaId,
      marcaNome: marcaNome,
      representante: nome,
      cor: cor,
      geoJson: geoJson
    };

    state.itensCadastrados.unshift(item);

    const itensDestaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === String(municipioId));
    MapManager.syncMunicipalityLayer(municipioId, geoJson, itensDestaCidade);

    atualizarSelectMunicipios();
    renderTabela();
    atualizarMetricas();
    atualizarResumoLateral();
    persistState();

    selectMunicipio.value = '';
    renderSelectMarcas(null);
    setCorAtual(getRandomColor());

    if (state.estadoBounds) {
      MapManager.fitToBounds(state.estadoBounds);
    }
  }

  // 12 cores recomendadas vibrantes e corporativas para toque rápido
  const CORES_RECOMENDADAS = [
    '#2563EB', '#059669', '#DC2626', '#D97706',
    '#0891B2', '#4F46E5', '#DB2777', '#EA580C',
    '#0D9488', '#65A30D', '#7C3AED', '#334155'
  ];

  let repSelecionadoParaCor = null;

  function abrirModalAlterarCor(nomeRep, corAtual) {
    if (!nomeRep) return;
    repSelecionadoParaCor = nomeRep;

    const modal = document.getElementById('modalAlterarCor');
    const txtSub = document.getElementById('modalCorNomeRep');
    const inputNome = document.getElementById('inputModalNomeRep');
    const infoCidades = document.getElementById('modalQtdCidadesInfo');
    const badge = document.getElementById('modalCorPreviewBadge');
    const inputCor = document.getElementById('inputModalCor');
    const inputHex = document.getElementById('inputModalCorHex');
    const paleta = document.getElementById('modalCorPaletaPredefinida');

    const totalCidades = new Set(
      state.itensCadastrados
        .filter(it => it.representante.trim().toLowerCase() === nomeRep.trim().toLowerCase())
        .map(it => String(it.municipioId))
    ).size;

    if (inputNome) {
      inputNome.value = nomeRep;
    }
    if (txtSub) {
      txtSub.textContent = t('modal_cor_sub_atual', { nome: nomeRep });
    }
    if (infoCidades) {
      infoCidades.textContent = t(totalCidades === 1 ? 'modal_cor_info_one' : 'modal_cor_info_other', { n: totalCidades });
    }

    const corInicial = (corAtual && corAtual.startsWith('#')) ? corAtual.toUpperCase() : '#2563EB';
    inputCor.value = corInicial;
    inputHex.value = corInicial;
    badge.style.backgroundColor = corInicial;

    paleta.innerHTML = '';
    CORES_RECOMENDADAS.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-9 h-9 rounded-xl border border-gray-300 shadow-xs transition-transform hover:scale-110 active:scale-95 focus:outline-none';
      btn.style.backgroundColor = c;
      btn.title = c;
      btn.addEventListener('click', () => {
        inputCor.value = c;
        inputHex.value = c.toUpperCase();
        badge.style.backgroundColor = c;
      });
      paleta.appendChild(btn);
    });

    modal.classList.remove('hidden');
    if (inputNome) {
      setTimeout(() => inputNome.focus(), 80);
    }
  }

  function atualizarDatalist() {
    const datalist = document.getElementById('datalistRepresentantes');
    if (!datalist) return;
    datalist.innerHTML = '';
    const repsUnicos = [...new Set(state.itensCadastrados.map(it => (it.representante || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    repsUnicos.forEach(rep => {
      const opt = document.createElement('option');
      opt.value = rep;
      datalist.appendChild(opt);
    });
  }

  function atualizarRepresentanteCompleto(nomeAntigo, novoNome, novaCor) {
    if (!nomeAntigo || !novoNome) return;
    const antigoLower = nomeAntigo.trim().toLowerCase();
    const nomeLimpo = novoNome.trim();
    const corLimpa = (novaCor && novaCor.startsWith('#')) ? novaCor.toUpperCase() : '#2563EB';

    let atualizados = 0;
    const cidadesAfetadas = new Set();

    state.itensCadastrados.forEach(it => {
      if (it.representante.trim().toLowerCase() === antigoLower) {
        it.representante = nomeLimpo;
        it.cor = corLimpa;
        cidadesAfetadas.add(String(it.municipioId));
        atualizados++;
      }
    });

    if (atualizados > 0) {
      if (state.representantesExistentes) {
        state.representantesExistentes.delete(nomeAntigo.trim());
        state.representantesExistentes.add(nomeLimpo);
      }
      atualizarDatalist();

      cidadesAfetadas.forEach(mId => {
        const itensDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
        MapManager.syncMunicipalityLayer(mId, null, itensDaCidade);
      });

      const inputRep = document.getElementById('inputRepresentante');
      if (inputRep && inputRep.value.trim().toLowerCase() === antigoLower) {
        inputRep.value = nomeLimpo;
        setCorAtual(corLimpa);
      }

      renderTabela();
      atualizarResumoLateral();
      atualizarMetricas();
      persistState();

      showToast(
        t(cidadesAfetadas.size === 1 ? 'toast_rep_atualizado_one' : 'toast_rep_atualizado_other', {
          nome: nomeLimpo,
          n: cidadesAfetadas.size
        }),
        'success'
      );
    }
  }

  function fecharModalAlterarCor() {
    const modal = document.getElementById('modalAlterarCor');
    if (modal) modal.classList.add('hidden');
    repSelecionadoParaCor = null;
  }

  function sincronizarCorRepresentante(nomeRep, novaCor) {
    const nomeLower = nomeRep.trim().toLowerCase();
    let atualizados = 0;
    const cidadesAfetadas = new Set();

    state.itensCadastrados.forEach(it => {
      if (it.representante.trim().toLowerCase() === nomeLower && it.cor !== novaCor) {
        it.cor = novaCor;
        cidadesAfetadas.add(String(it.municipioId));
        atualizados++;
      }
    });

    if (atualizados > 0) {
      cidadesAfetadas.forEach(mId => {
        const itensDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
        MapManager.syncMunicipalityLayer(mId, null, itensDaCidade);
      });
      renderTabela();
      persistState();
    }
  }

  function alterarCorRepresentante(nomeRep, novaCor) {
    if (!nomeRep || !novaCor) return;
    sincronizarCorRepresentante(nomeRep, novaCor);
    const inputRep = document.getElementById('inputRepresentante');
    if (inputRep && inputRep.value.trim().toLowerCase() === nomeRep.trim().toLowerCase()) {
      setCorAtual(novaCor);
    }
  }

  function renderTabela() {
    const tbody = document.getElementById('tabelaCorpo');
    const badgeCount = document.getElementById('badgeTableCount');
    const termo = (document.getElementById('inputBuscaTabela').value || '').trim().toLowerCase();

    let itens = state.itensCadastrados;
    if (termo) {
      itens = itens.filter(it =>
        it.municipioNome.toLowerCase().includes(termo) ||
        it.representante.toLowerCase().includes(termo) ||
        it.marcaNome.toLowerCase().includes(termo) ||
        it.estadoSigla.toLowerCase().includes(termo) ||
        String(it.seqId).includes(termo)
      );
    }

    const totalLen = state.itensCadastrados.length;
    badgeCount.textContent = t(totalLen === 1 ? 'table_count_one' : 'table_count_other', { n: totalLen });
    atualizarResumoLateral();
    atualizarDatalist();

    if (itens.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-10 text-center text-gray-500 font-medium">
            ${totalLen === 0 ? t('table_empty_no_items') : t('table_empty_no_results')}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';

    itens.forEach(item => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100';
      const editTitle = t('title_editar_rep', { nome: escapeHtml(item.representante) });

      tr.innerHTML = `
        <td class="py-3 px-4 text-center font-bold text-black">
          <span class="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 text-black border border-gray-300">
            Nº ${item.seqId}
          </span>
        </td>
        <td class="py-3 px-4 text-center">
          <button type="button" class="btn-abrir-modal-cor inline-flex items-center justify-center space-x-2 py-1 px-2.5 rounded-lg hover:bg-purple-50 border border-gray-300 hover:border-purple-600 transition-all group" data-rep="${escapeHtml(item.representante)}" data-cor="${item.cor}" title="${editTitle}">
            <div class="w-5 h-5 rounded-md shadow-xs border border-black/20 flex-shrink-0 transition-transform group-hover:scale-110" style="background-color: ${item.cor};"></div>
            <span class="text-xs font-mono uppercase text-black font-bold">${item.cor}</span>
          </button>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
            ${item.estadoSigla}
          </span>
        </td>
        <td class="py-3 px-4 font-bold text-black">
          ${escapeHtml(item.municipioNome)}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="rep-brand-badge brand-${item.marcaId}">
            ${escapeHtml(item.marcaNome)}
          </span>
        </td>
        <td class="py-3 px-4 font-semibold text-black">
          <div class="flex items-center justify-between gap-1 max-w-[210px]">
            <div class="flex items-center gap-2 overflow-hidden">
              <button type="button" class="btn-abrir-modal-cor inline-flex items-center p-0.5 rounded-full hover:ring-2 hover:ring-purple-600 transition-all flex-shrink-0" data-rep="${escapeHtml(item.representante)}" data-cor="${item.cor}" title="${editTitle}">
                <span class="w-3.5 h-3.5 rounded-full border border-gray-400 flex-shrink-0" style="background-color: ${item.cor};"></span>
              </button>
              <span class="truncate">${escapeHtml(item.representante)}</span>
            </div>
            <button type="button" class="btn-abrir-modal-cor text-gray-400 hover:text-purple-700 hover:bg-purple-100 p-1 rounded transition-colors flex-shrink-0" data-rep="${escapeHtml(item.representante)}" data-cor="${item.cor}" title="${editTitle}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          </div>
        </td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center space-x-2">
            <button data-id="${item.id}" class="btn-focar text-purple-700 hover:text-purple-900 p-1.5 hover:bg-purple-100 rounded-md transition-colors" title="${t('title_focar_mapa')}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button data-id="${item.id}" class="btn-remover text-rose-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-md transition-colors" title="${t('title_remover_registro')}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-remover').forEach(btn => {
      btn.addEventListener('click', (e) => {
        removerItem(e.currentTarget.dataset.id);
      });
    });

    tbody.querySelectorAll('.btn-focar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const item = state.itensCadastrados.find(it => it.id === id);
        if (item) {
          const entry = MapManager.getCityLayer(item.municipioId);
          if (entry && entry.layer) {
            const map = MapManager.getMapInstance();
            map.fitBounds(entry.layer.getBounds(), { maxZoom: 12, padding: [50, 50] });
            entry.layer.setStyle({ weight: 4, color: '#FFFFFF' });
            setTimeout(() => {
              if (entry.layer) entry.layer.setStyle({ weight: 1.8, color: '#111827' });
            }, 1800);
          }
        }
      });
    });
  }

  function removerItem(id) {
    const index = state.itensCadastrados.findIndex(it => it.id === id);
    if (index === -1) return;

    const item = state.itensCadastrados[index];
    const mId = String(item.municipioId);

    state.itensCadastrados.splice(index, 1);

    const itensRestantesDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
    MapManager.syncMunicipalityLayer(mId, null, itensRestantesDaCidade);

    atualizarSelectMunicipios();
    renderTabela();
    atualizarMetricas();
    atualizarResumoLateral();
    persistState();
  }

  function atualizarMetricas() {
    document.getElementById('metricTotalCidades').textContent = new Set(
      state.itensCadastrados.map(it => String(it.municipioId))
    ).size;
    const reps = new Set(state.itensCadastrados.map(it => it.representante.trim().toLowerCase())).size;
    document.getElementById('metricTotalReps').textContent = reps;
  }

  function baixarPlanilhaModelo() {
    if (!state.estadoSelecionado) {
      showToast(t('toast_sel_estado_modelo'), 'warning');
      return;
    }
    if (!state.municipiosAtuais || state.municipiosAtuais.length === 0) {
      showToast(t('toast_aguarde_municipios'), 'warning');
      return;
    }

    try {
      ExcelManager.downloadTemplate(
        state.estadoSelecionado.sigla,
        state.municipiosAtuais,
        state.marcas
      );
      showToast(t('toast_modelo_baixado', { n: state.municipiosAtuais.length }), 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function processarPlanilhaUpload(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      showToast(t('toast_arq_invalido'), 'error');
      return;
    }

    try {
      const rows = await ExcelManager.readImportFile(file);
      if (rows.length === 0) {
        showToast(t('toast_planilha_vazia'), 'warning');
        return;
      }
      await executarImportacaoEmLote(rows);
    } catch (err) {
      console.error(err);
      showToast(t('toast_erro_planilha') + err.message, 'error');
    }
  }

  async function executarImportacaoEmLote(rows) {
    const modal = document.getElementById('modalProgresso');
    const txtProgresso = document.getElementById('modalProgressoTexto');
    const pctProgresso = document.getElementById('modalProgressoPorcentagem');
    const barraProgresso = document.getElementById('modalProgressoBarra');

    modal.classList.remove('hidden');

    const total = rows.length;
    let concluidos = 0;
    let adicionados = 0;
    let erros = 0;

    const coresReps = new Map();
    state.itensCadastrados.forEach(it => {
      coresReps.set(it.representante.trim().toLowerCase(), it.cor);
    });

    const cidadesModificadas = new Set();
    const batchSize = 4;

    for (let i = 0; i < total; i += batchSize) {
      const lote = rows.slice(i, i + batchSize);

      await Promise.all(lote.map(async (row) => {
        const idIbge = String(row['ID IBGE'] || row['ID'] || row['IBGE'] || row['id_ibge'] || row['Codigo']).trim();
        const nomeRep = String(row['Representante'] || row['representante'] || row['REPRESENTANTE']).trim();
        const nomeMun = String(row['Município'] || row['Municipio'] || row['municipio'] || 'Município').trim();
        const siglaUf = String(row['Estado'] || row['UF'] || row['uf'] || (state.estadoSelecionado ? state.estadoSelecionado.sigla : 'BR')).trim();
        let nomeMarca = String(row['Marca'] || row['marca'] || row['MARCA'] || '').trim();
        let corHex = String(row['Cor Hex'] || row['Cor'] || row['cor'] || '').trim().toUpperCase();

        try {
          let marcaObj = null;
          if (nomeMarca) {
            marcaObj = state.marcas.find(m => m.nome.toLowerCase() === nomeMarca.toLowerCase());
          }
          if (!marcaObj) {
            const marcasUsadas = new Set(
              state.itensCadastrados.filter(it => String(it.municipioId) === idIbge).map(it => it.marcaId)
            );
            marcaObj = state.marcas.find(m => !marcasUsadas.has(m.id)) || state.marcas[0];
          }

          const idxAntigo = state.itensCadastrados.findIndex(
            it => String(it.municipioId) === idIbge && it.marcaId === marcaObj.id
          );
          if (idxAntigo !== -1) {
            state.itensCadastrados.splice(idxAntigo, 1);
          }

          const qtdAtual = state.itensCadastrados.filter(it => String(it.municipioId) === idIbge).length;
          if (qtdAtual >= 6) {
            return;
          }

          const repKey = nomeRep.toLowerCase();
          if (!corHex || !/^#[0-9A-F]{6}$/i.test(corHex)) {
            if (coresReps.has(repKey)) {
              corHex = coresReps.get(repKey);
            } else {
              corHex = getRandomColor();
              coresReps.set(repKey, corHex);
            }
          } else {
            coresReps.set(repKey, corHex);
            sincronizarCorRepresentante(nomeRep, corHex);
          }

          const geoJson = await IBGEService.getMalhaMunicipio(idIbge);
          if (!geoJson) throw new Error('Malha vazia');

          const seqId = state.nextSeqId++;
          const item = {
            id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            seqId: seqId,
            estadoId: '',
            estadoSigla: siglaUf,
            estadoNome: '',
            municipioId: idIbge,
            municipioNome: nomeMun,
            marcaId: marcaObj.id,
            marcaNome: marcaObj.nome,
            representante: nomeRep,
            cor: corHex,
            geoJson: geoJson
          };

          state.itensCadastrados.unshift(item);
          cidadesModificadas.add(idIbge);
          adicionados++;

        } catch (err) {
          console.error(`Erro no município ${idIbge}:`, err);
          erros++;
        } finally {
          concluidos++;
          const pct = Math.round((concluidos / total) * 100);
          txtProgresso.textContent = t('modal_prog_count', { atual: concluidos, total });
          pctProgresso.textContent = `${pct}%`;
          barraProgresso.style.width = `${pct}%`;
        }
      }));
    }

    cidadesModificadas.forEach(mId => {
      const itensDaCidade = state.itensCadastrados.filter(it => String(it.municipioId) === mId);
      const geoJson = itensDaCidade[0] ? itensDaCidade[0].geoJson : null;
      MapManager.syncMunicipalityLayer(mId, geoJson, itensDaCidade);
    });

    modal.classList.add('hidden');

    atualizarSelectMunicipios();
    renderTabela();
    atualizarMetricas();
    atualizarResumoLateral();
    persistState();

    if (state.itensCadastrados.length > 0) {
      MapManager.fitAllRegisteredCities();
    }

    const errPart = erros > 0 ? t('toast_import_err_part', { erros }) : '';
    showToast(t('toast_import_ok', { add: adicionados, err: errPart }), adicionados > 0 ? 'success' : 'warning');
  }

  /**
   * Obtém ou carrega a malha municipal do estado ativo (ou do primeiro item cadastrado)
   */
  async function obterMalhaParaExportacao() {
    let malha = state.malhaMunicipios;
    if (!malha) {
      const sigla = state.estadoSelecionado
        ? state.estadoSelecionado.sigla
        : (state.itensCadastrados[0] ? state.itensCadastrados[0].estadoSigla : null);
      if (sigla) {
        malha = await IBGEService.getMalhaMunicipiosEstado(sigla);
        state.malhaMunicipios = malha;
      }
    }
    return malha;
  }

  /**
   * 1. Baixar Apenas Imagem (PNG)
   */
  async function baixarApenasImagem() {
    if (state.isExporting) return;
    if (state.itensCadastrados.length === 0) {
      showToast(t('toast_cadastre_antes'), 'warning');
      return;
    }

    state.isExporting = true;
    const btn = document.getElementById('btnBaixarImagem');
    const btnText = document.getElementById('btnBaixarImagemText');

    try {
      if (btn) btn.classList.add('opacity-75', 'cursor-wait');
      if (btnText) btnText.textContent = t('export_img_loading');

      const malha = await obterMalhaParaExportacao();
      const vectorMapResult = await ExcelManager.renderExecutiveVectorMap(
        malha,
        state.itensCadastrados,
        state.estadoSelecionado,
        state.municipiosAtuais
      );

      const ufSigla = state.estadoSelecionado ? state.estadoSelecionado.sigla : '';
      ExcelManager.downloadSingleImage(vectorMapResult.blob, ufSigla);
      showToast(t('toast_img_ok'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('toast_erro_pacote') + err.message, 'error');
    } finally {
      state.isExporting = false;
      if (btnText) btnText.textContent = t('btn_baixar_imagem');
      if (btn) btn.classList.remove('opacity-75', 'cursor-wait');
    }
  }

  /**
   * 2. Baixar Apenas PDF
   */
  async function baixarApenasPdf() {
    if (state.isExporting) return;
    if (state.itensCadastrados.length === 0) {
      showToast(t('toast_cadastre_antes'), 'warning');
      return;
    }

    state.isExporting = true;
    const btn = document.getElementById('btnBaixarPdf');
    const btnText = document.getElementById('btnBaixarPdfText');

    try {
      if (btn) btn.classList.add('opacity-75', 'cursor-wait');
      if (btnText) btnText.textContent = t('export_pdf_loading');

      const malha = await obterMalhaParaExportacao();
      const vectorMapResult = await ExcelManager.renderExecutiveVectorMap(
        malha,
        state.itensCadastrados,
        state.estadoSelecionado,
        state.municipiosAtuais
      );

      const pdfBlob = await ExcelManager.generatePdfReport(
        vectorMapResult,
        state.estadoSelecionado,
        state.itensCadastrados,
        state.municipiosAtuais
      );

      const ufSigla = state.estadoSelecionado ? state.estadoSelecionado.sigla : '';
      ExcelManager.downloadSinglePdf(pdfBlob, ufSigla);
      showToast(t('toast_pdf_ok'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('toast_erro_pacote') + err.message, 'error');
    } finally {
      state.isExporting = false;
      if (btnText) btnText.textContent = t('btn_baixar_pdf');
      if (btn) btn.classList.remove('opacity-75', 'cursor-wait');
    }
  }

  /**
   * 3. Baixar Apenas Planilha Excel (.xlsx)
   */
  async function baixarApenasExcel() {
    if (state.isExporting) return;
    if (state.itensCadastrados.length === 0) {
      showToast(t('toast_cadastre_antes'), 'warning');
      return;
    }

    state.isExporting = true;
    const btn = document.getElementById('btnBaixarExcel');
    const btnText = document.getElementById('btnBaixarExcelText');

    try {
      if (btn) btn.classList.add('opacity-75', 'cursor-wait');
      if (btnText) btnText.textContent = t('export_excel_loading');

      const excelBuffer = await ExcelManager.generateStyledExcelBuffer(state.itensCadastrados);
      const ufSigla = state.estadoSelecionado ? state.estadoSelecionado.sigla : '';
      ExcelManager.downloadSingleExcel(excelBuffer, ufSigla);
      showToast(t('toast_excel_ok'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('toast_erro_pacote') + err.message, 'error');
    } finally {
      state.isExporting = false;
      if (btnText) btnText.textContent = t('btn_baixar_excel');
      if (btn) btn.classList.remove('opacity-75', 'cursor-wait');
    }
  }

  /**
   * 4. Baixar Pacote Final (.zip)
   */
  async function baixarPacoteFinal() {
    if (state.isExporting) return;

    if (state.itensCadastrados.length === 0) {
      showToast(t('toast_cadastre_antes'), 'warning');
      return;
    }

    state.isExporting = true;
    const btn = document.getElementById('btnBaixarPacote');
    const btnText = document.getElementById('btnBaixarPacoteText');

    try {
      btn.classList.add('opacity-75', 'cursor-wait');
      btnText.textContent = t('export_step_1');

      const malha = await obterMalhaParaExportacao();

      const vectorMapResult = await ExcelManager.renderExecutiveVectorMap(
        malha,
        state.itensCadastrados,
        state.estadoSelecionado,
        state.municipiosAtuais
      );

      btnText.textContent = t('export_step_2');
      const excelBuffer = await ExcelManager.generateStyledExcelBuffer(state.itensCadastrados);

      btnText.textContent = t('export_step_3');
      const pdfBlob = await ExcelManager.generatePdfReport(
        vectorMapResult,
        state.estadoSelecionado,
        state.itensCadastrados,
        state.municipiosAtuais
      );

      btnText.textContent = t('export_step_4');
      await ExcelManager.downloadZipPackage(vectorMapResult.blob, excelBuffer, pdfBlob);

      showToast(t('toast_pacote_ok'), 'success');

    } catch (err) {
      console.error(err);
      showToast(t('toast_erro_pacote') + err.message, 'error');
    } finally {
      state.isExporting = false;
      btnText.textContent = t('btn_baixar_pacote');
      btn.classList.remove('opacity-75', 'cursor-wait');
    }
  }

  function setCorAtual(corHex) {
    const val = corHex.toUpperCase();
    document.getElementById('inputCor').value = val;
    document.getElementById('inputCorHex').value = val;
  }

  function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    return hslToHex(hue, 75, 52);
  }

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
  }

  function showToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center p-3.5 rounded-xl shadow-lg border text-xs sm:text-sm font-medium transition-all transform duration-300 translate-y-2 opacity-0 max-w-sm ${
      tipo === 'success' ? 'bg-emerald-900 text-emerald-100 border-emerald-700' :
      tipo === 'error' ? 'bg-rose-900 text-rose-100 border-rose-700' :
      tipo === 'warning' ? 'bg-amber-900 text-amber-100 border-amber-700' :
      'bg-gray-900 text-white border-blue-500'
    }`;

    const icon = tipo === 'success' ? '✓' : tipo === 'error' ? '✕' : tipo === 'warning' ? '⚠' : 'ℹ';
    toast.innerHTML = `<span class="mr-2 text-base font-bold">${icon}</span><span>${mensagem}</span>`;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  return {
    init,
    onLanguageChanged,
    alterarCorRepresentante,
    abrirModalAlterarCor
  };
})();

window.App = App;
window.addEventListener('DOMContentLoaded', App.init);
