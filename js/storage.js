/**
 * MÓDULO: STORAGE MANAGER (IndexedDB Auto-Save)
 * Responsável por:
 * 1. Armazenamento automático local em segundo plano via IndexedDB (sem necessidade de login/cadastro).
 * 2. Isolamento total por navegador e perfil de usuário (nenhum dado é enviado para servidores externos).
 * 3. Restauração automática do estado do trabalho ao reabrir ou atualizar o navegador.
 * 4. Controle de alterações pendentes para proteção inteligente no evento beforeunload.
 * 5. Limpeza completa dos dados salvos quando o usuário desejar iniciar um novo trabalho.
 */

const StorageManager = (() => {
  const DB_NAME = 'GestorRepresentantesDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'workspace';
  const WORKSPACE_KEY = 'active_session';

  let dbInstance = null;
  let saveTimer = null;
  let pendingSnapshot = null;
  let hasPendingChanges = false;
  let isSaving = false;
  let lastSavedStatus = 'saved'; // 'saving' | 'saved' | 'error'

  function t(key, params = {}) {
    return (window.I18nManager && window.I18nManager.t) ? window.I18nManager.t(key, params) : key;
  }

  /**
   * Abre ou cria o banco IndexedDB local do navegador
   */
  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB não suportado neste navegador.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(event.target.error || new Error('Falha ao abrir IndexedDB.'));
      };
    });
  }

  /**
   * Atualiza o indicador visual de status de salvamento na interface
   */
  function updateStatusUI(status) {
    lastSavedStatus = status;
    const badge = document.getElementById('autoSaveBadge');
    const iconSaving = document.getElementById('autoSaveIconSaving');
    const iconSaved = document.getElementById('autoSaveIconSaved');
    const textEl = document.getElementById('autoSaveText');

    if (!badge || !textEl) return;

    if (status === 'saving') {
      if (iconSaving) iconSaving.classList.remove('hidden');
      if (iconSaved) iconSaved.classList.add('hidden');
      textEl.setAttribute('data-i18n', 'autosave_saving');
      textEl.textContent = t('autosave_saving');
    } else if (status === 'error') {
      if (iconSaving) iconSaving.classList.add('hidden');
      if (iconSaved) iconSaved.classList.remove('hidden');
      textEl.setAttribute('data-i18n', 'autosave_error');
      textEl.textContent = t('autosave_error');
    } else {
      if (iconSaving) iconSaving.classList.add('hidden');
      if (iconSaved) iconSaved.classList.remove('hidden');
      textEl.setAttribute('data-i18n', 'autosave_saved');
      textEl.textContent = t('autosave_saved');
    }
  }

  /**
   * Grava imediatamente o snapshot no IndexedDB
   */
  async function writeToIndexedDB(snapshot) {
    if (!snapshot) return false;
    isSaving = true;
    updateStatusUI('saving');

    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        // Armazena uma cópia enxuta e segura dos itens (preservando geoJson para restauração instantânea)
        const payload = {
          id: WORKSPACE_KEY,
          updatedAt: Date.now(),
          estadoSelecionadoId: snapshot.estadoSelecionado ? snapshot.estadoSelecionado.id : null,
          marcas: Array.isArray(snapshot.marcas) ? snapshot.marcas.map(m => ({ id: m.id, nome: m.nome })) : [],
          nextSeqId: snapshot.nextSeqId || 1,
          itensCadastrados: Array.isArray(snapshot.itensCadastrados)
            ? snapshot.itensCadastrados.map(it => ({
                id: it.id,
                seqId: it.seqId,
                estadoId: it.estadoId,
                estadoSigla: it.estadoSigla,
                estadoNome: it.estadoNome,
                municipioId: it.municipioId,
                municipioNome: it.municipioNome,
                marcaId: it.marcaId,
                marcaNome: it.marcaNome,
                representante: it.representante,
                cor: it.cor,
                geoJson: it.geoJson || null
              }))
            : []
        };

        store.put(payload);

        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error || new Error('Erro na transação IndexedDB'));
      });

      hasPendingChanges = false;
      pendingSnapshot = null;
      isSaving = false;
      updateStatusUI('saved');
      return true;
    } catch (err) {
      console.error('[StorageManager] Erro ao salvar no IndexedDB:', err);
      isSaving = false;
      updateStatusUI('error');
      return false;
    }
  }

  /**
   * Agenda um salvamento automático em segundo plano (com debounce leve de 180ms)
   */
  function scheduleSave(stateSnapshot) {
    pendingSnapshot = stateSnapshot;
    hasPendingChanges = true;
    updateStatusUI('saving');

    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (pendingSnapshot) {
        writeToIndexedDB(pendingSnapshot);
      }
    }, 180);
  }

  /**
   * Força a gravação imediata caso haja alterações pendentes (ex: no beforeunload)
   */
  function flushPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (hasPendingChanges && pendingSnapshot) {
      writeToIndexedDB(pendingSnapshot);
    }
  }

  /**
   * Carrega o último trabalho salvo no IndexedDB
   */
  async function loadWorkspace() {
    try {
      const db = await openDB();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(WORKSPACE_KEY);

        req.onsuccess = (e) => {
          resolve(e.target.result || null);
        };
        req.onerror = (e) => {
          reject(e.target.error);
        };
      });
    } catch (err) {
      console.warn('[StorageManager] Não foi possível carregar estado anterior do IndexedDB:', err);
      return null;
    }
  }

  /**
   * Apaga todos os dados salvos no IndexedDB local para iniciar um novo trabalho
   */
  async function clearWorkspace() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    pendingSnapshot = null;
    hasPendingChanges = false;

    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(WORKSPACE_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });
      updateStatusUI('saved');
      return true;
    } catch (err) {
      console.error('[StorageManager] Erro ao limpar IndexedDB:', err);
      return false;
    }
  }

  return {
    openDB,
    scheduleSave,
    flushPendingSave,
    loadWorkspace,
    clearWorkspace,
    hasUnsavedChanges: () => hasPendingChanges || isSaving,
    refreshStatusText: () => updateStatusUI(lastSavedStatus)
  };
})();

window.StorageManager = StorageManager;
