/**
 * MÓDULO: IBGE SERVICE
 * Responsável por todas as consultas à API de Localidades e Malhas do IBGE,
 * incluindo cache de requisições, malhas de municípios integradas e coordenadas limites (bounding boxes).
 */

const IBGEService = (() => {
  // Cache em memória para evitar requisições repetidas de GeoJSON
  const geoCache = new Map();

  // Bounding Boxes [ [minLat, minLng], [maxLat, maxLng] ] de todos os 27 estados do Brasil
  const UF_BOUNDS = {
    AC: [[-11.145, -73.990], [-7.111, -66.623]],
    AL: [[-10.504, -38.237], [-8.813, -35.152]],
    AP: [[-1.236, -54.876], [4.442, -49.865]],
    AM: [[-9.818, -73.796], [2.247, -56.097]],
    BA: [[-18.349, -46.617], [-8.533, -37.348]],
    CE: [[-7.858, -41.424], [-2.784, -37.253]],
    DF: [[-16.052, -48.287], [-15.500, -47.308]],
    ES: [[-21.302, -41.880], [-17.892, -39.664]],
    GO: [[-19.499, -53.251], [-12.395, -45.906]],
    MA: [[-10.262, -48.755], [-1.049, -41.794]],
    MT: [[-18.041, -61.633], [-7.349, -50.225]],
    MS: [[-24.068, -58.175], [-17.166, -51.339]],
    MG: [[-22.923, -51.056], [-14.233, -39.856]],
    PA: [[-9.841, -58.898], [2.591, -46.061]],
    PB: [[-8.303, -38.765], [-6.026, -34.793]],
    PR: [[-26.717, -54.619], [-22.516, -48.024]],
    PE: [[-9.483, -41.358], [-7.121, -34.793]],
    PI: [[-10.929, -45.994], [-2.747, -40.370]],
    RJ: [[-23.369, -44.889], [-20.763, -40.957]],
    RN: [[-6.983, -38.581], [-4.831, -34.975]],
    RS: [[-33.751, -57.649], [-27.081, -49.691]],
    RO: [[-13.694, -66.621], [-7.969, -59.774]],
    RR: [[-1.581, -64.825], [5.272, -58.887]],
    SC: [[-29.351, -53.837], [-25.956, -48.357]],
    SP: [[-25.312, -53.110], [-19.779, -44.161]],
    SE: [[-11.569, -38.245], [-9.515, -36.393]],
    TO: [[-13.468, -50.742], [-5.168, -45.688]]
  };

  // Lista estática oficial dos 27 estados do Brasil (Fallback de segurança contra bloqueios CORS ou instabilidade do IBGE)
  const ESTADOS_FALLBACK = [
    { id: 12, sigla: 'AC', nome: 'Acre' },
    { id: 27, sigla: 'AL', nome: 'Alagoas' },
    { id: 16, sigla: 'AP', nome: 'Amapá' },
    { id: 13, sigla: 'AM', nome: 'Amazonas' },
    { id: 29, sigla: 'BA', nome: 'Bahia' },
    { id: 23, sigla: 'CE', nome: 'Ceará' },
    { id: 53, sigla: 'DF', nome: 'Distrito Federal' },
    { id: 32, sigla: 'ES', nome: 'Espírito Santo' },
    { id: 52, sigla: 'GO', nome: 'Goiás' },
    { id: 21, sigla: 'MA', nome: 'Maranhão' },
    { id: 51, sigla: 'MT', nome: 'Mato Grosso' },
    { id: 50, sigla: 'MS', nome: 'Mato Grosso do Sul' },
    { id: 31, sigla: 'MG', nome: 'Minas Gerais' },
    { id: 15, sigla: 'PA', nome: 'Pará' },
    { id: 25, sigla: 'PB', nome: 'Paraíba' },
    { id: 41, sigla: 'PR', nome: 'Paraná' },
    { id: 26, sigla: 'PE', nome: 'Pernambuco' },
    { id: 22, sigla: 'PI', nome: 'Piauí' },
    { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro' },
    { id: 24, sigla: 'RN', nome: 'Rio Grande do Norte' },
    { id: 43, sigla: 'RS', nome: 'Rio Grande do Sul' },
    { id: 11, sigla: 'RO', nome: 'Rondônia' },
    { id: 14, sigla: 'RR', nome: 'Roraima' },
    { id: 42, sigla: 'SC', nome: 'Santa Catarina' },
    { id: 35, sigla: 'SP', nome: 'São Paulo' },
    { id: 28, sigla: 'SE', nome: 'Sergipe' },
    { id: 17, sigla: 'TO', nome: 'Tocantins' }
  ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  /**
   * Executa requisições para a API do IBGE com roteamento inteligente anti-CORS:
   * 1. Tenta o proxy `/api/ibge/...` (Vercel rewrites na web ou server.js no ambiente local)
   * 2. Se falhar ou estiver em file://, tenta a chamada direta na API do IBGE
   * 3. Se o navegador bloquear por CORS, usa o proxy público de contingência (allorigins)
   */
  async function fetchIBGE(endpointPath) {
    const cleanPath = endpointPath.replace(/^\/?(api\/)?/, '');
    const isFileProtocol = window.location.protocol === 'file:';

    // 1. Proxy dedicado do Vercel / server.js (100% livre de CORS)
    if (!isFileProtocol) {
      try {
        const proxyUrl = `/api/ibge/${cleanPath}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn(`[IBGE] Falha no proxy /api/ibge/${cleanPath}, tentando direto:`, e);
      }
    }

    // 2. Chamada direta ao endpoint governamental do IBGE
    const directUrl = `https://servicodados.ibge.gov.br/api/${cleanPath}`;
    try {
      const res = await fetch(directUrl);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn(`[IBGE] Falha na chamada direta para ${directUrl}, tentando contingência CORS:`, e);
    }

    // 3. Proxy de contingência pública para contornar restrições estritas de CORS no browser
    try {
      const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
      const res = await fetch(fallbackUrl);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error(`[IBGE] Falha em todas as vias de acesso para ${cleanPath}:`, e);
    }

    throw new Error(`Não foi possível carregar os dados geográficos do IBGE (${cleanPath}).`);
  }

  /**
   * Obtém todos os Estados do Brasil ordenados por nome (100% local e instantâneo, livre de bloqueios CORS/WAF)
   */
  async function getEstados() {
    return ESTADOS_FALLBACK;
  }

  const ID_TO_SIGLA = {
    11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO',
    21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA',
    31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP',
    41: 'PR', 42: 'SC', 43: 'RS',
    50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF'
  };

  function toSigla(ufSiglaOuId) {
    if (!ufSiglaOuId) return 'SP';
    if (typeof ufSiglaOuId === 'string' && ufSiglaOuId.trim().length === 2) {
      return ufSiglaOuId.trim().toUpperCase();
    }
    const num = Number(ufSiglaOuId);
    return ID_TO_SIGLA[num] || String(ufSiglaOuId).toUpperCase();
  }

  /**
   * Obtém os municípios de um determinado Estado
   */
  async function getMunicipios(ufId) {
    const sigla = toSigla(ufId);
    // 1. Tenta carregar do dataset estático local em data/municipios/{SIGLA}.json (Zero CORS, 15ms no Vercel Edge)
    try {
      const res = await fetch(`data/municipios/${sigla}.json`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (e) {
      console.warn(`[Local] Falha ao carregar data/municipios/${sigla}.json, usando fallback IBGE:`, e);
    }
    // 2. Fallback para API do IBGE
    return await fetchIBGE(`v1/localidades/estados/${ufId}/municipios?orderBy=nome`);
  }

  /**
   * Obtém a malha GeoJSON de um município específico
   */
  async function getMalhaMunicipio(municipioId) {
    const key = `MUN_${municipioId}`;
    if (geoCache.has(key)) {
      return geoCache.get(key);
    }

    // 1. Tenta extrair a feature diretamente do dataset de divisões do Estado (Zero CORS, 0ms)
    const mIdStr = String(municipioId);
    const ufCode = Number(mIdStr.substring(0, 2));
    const sigla = ID_TO_SIGLA[ufCode];
    if (sigla) {
      try {
        const malhaEstado = await getMalhaMunicipiosEstado(sigla);
        if (malhaEstado && Array.isArray(malhaEstado.features)) {
          const feature = malhaEstado.features.find(f => 
            String(f.id) === mIdStr ||
            (f.properties && (String(f.properties.codarea) === mIdStr || String(f.properties.id) === mIdStr))
          );
          if (feature) {
            geoCache.set(key, feature);
            return feature;
          }
        }
      } catch (e) {
        console.warn(`[Local] Não foi possível extrair a malha do município ${municipioId} de ${sigla}:`, e);
      }
    }

    // 2. Fallback para API do IBGE
    const data = await fetchIBGE(`v3/malhas/municipios/${municipioId}?formato=application/vnd.geo+json`);
    geoCache.set(key, data);
    return data;
  }

  /**
   * Obtém o contorno geral do Estado (fronteira externa)
   */
  async function getMalhaEstado(ufSiglaOuId) {
    const sigla = toSigla(ufSiglaOuId);
    const key = `UF_BORDER_${sigla}`;
    if (geoCache.has(key)) {
      return geoCache.get(key);
    }

    // 1. Tenta carregar do dataset estático local (Zero CORS, instantâneo)
    try {
      const res = await fetch(`data/malhas_estados/${sigla}.json`);
      if (res.ok) {
        const data = await res.json();
        geoCache.set(key, data);
        return data;
      }
    } catch (e) {
      console.warn(`[Local] Falha ao carregar data/malhas_estados/${sigla}.json:`, e);
    }

    // 2. Fallback para API do IBGE
    const data = await fetchIBGE(`v3/malhas/estados/${sigla}?formato=application/vnd.geo+json&qualidade=minima`);
    geoCache.set(key, data);
    return data;
  }

  /**
   * Obtém todas as divisões municipais internas do Estado (todos os municípios em uma única chamada rápida)
   * API IBGE: /api/v3/malhas/estados/{UF}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima
   */
  async function getMalhaMunicipiosEstado(ufSiglaOuId) {
    const sigla = toSigla(ufSiglaOuId);
    const key = `UF_MUNICIPIOS_${sigla}`;
    if (geoCache.has(key)) {
      return geoCache.get(key);
    }

    // 1. Tenta carregar do dataset estático local (Zero CORS, instantâneo)
    try {
      const res = await fetch(`data/malhas_municipios/${sigla}.json`);
      if (res.ok) {
        const data = await res.json();
        geoCache.set(key, data);
        return data;
      }
    } catch (e) {
      console.warn(`[Local] Falha ao carregar data/malhas_municipios/${sigla}.json:`, e);
    }

    // 2. Fallback para API do IBGE
    const data = await fetchIBGE(`v3/malhas/estados/${sigla}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima`);
    geoCache.set(key, data);
    return data;
  }

  /**
   * Retorna os limites pré-computados para um Estado pela sigla (ex: 'SP')
   */
  function getEstadoBounds(sigla) {
    if (!sigla) return null;
    const key = sigla.toUpperCase();
    return UF_BOUNDS[key] || null;
  }

  return {
    getEstados,
    getMunicipios,
    getMalhaMunicipio,
    getMalhaEstado,
    getMalhaMunicipiosEstado,
    getEstadoBounds
  };
})();
