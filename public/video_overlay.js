const leftPanel = document.getElementById('leftPanel');
const rightPanel = document.getElementById('rightPanel');
const toggleButton = document.getElementById('toggleButton');
const globalTooltip = document.getElementById('globalTooltip');
const bodyElement = document.body;
const layoutMode = bodyElement && bodyElement.dataset
    ? bodyElement.dataset.overlayLayout || ''
    : '';
const isMobileLayout = layoutMode === 'mobile';
const townsfolkTitleEl = document.getElementById('townsfolkTitle');
const outsiderTitleEl = document.getElementById('outsiderTitle');
const minionTitleEl = document.getElementById('minionTitle');
const demonTitleEl = document.getElementById('demonTitle');
const jinxTitleEl = document.getElementById('jinxTitle');
const townsfolkGrid = document.getElementById('townsfolkGrid');
const outsiderGrid = document.getElementById('outsiderGrid');
const minionGrid = document.getElementById('minionGrid');
const demonGrid = document.getElementById('demonGrid');
const jinxGrid = document.getElementById('jinxGrid');
const firstNightList = document.getElementById('firstNightList');
const otherNightList = document.getElementById('otherNightList');

const CATEGORY_DEFAULT_NAMES = {
    townsfolk: '鎮民',
    outsider: '外來者',
    minion: '爪牙',
    demon: '惡魔',
    'a jinxed': '相剋規則'
};

const categoryElements = {
    townsfolk: { title: townsfolkTitleEl, grid: townsfolkGrid },
    outsider: { title: outsiderTitleEl, grid: outsiderGrid },
    minion: { title: minionTitleEl, grid: minionGrid },
    demon: { title: demonTitleEl, grid: demonGrid },
    'a jinxed': { title: jinxTitleEl, grid: jinxGrid }
};

let isVisible = false;
let twitchAuthorized = false;
let lastAppliedSignature = null;

if (isMobileLayout) {
    isVisible = true;
    if (leftPanel) {
        leftPanel.classList.add('show');
    }
    if (rightPanel) {
        rightPanel.classList.add('show');
    }
    if (toggleButton) {
        toggleButton.style.display = 'none';
    }
}

const urlParams = new URLSearchParams(window.location.search);
const rawAssetsBase = urlParams.get('assetsBase') || '';

let assetBaseUrl = null;
if (rawAssetsBase) {
    try {
        assetBaseUrl = new URL(rawAssetsBase, window.location.href);
    } catch (err) {
        console.warn('指定的 assetsBase 無法解析，將改用預設來源:', err);
        assetBaseUrl = null;
    }
}

function resolveAssetUrl(path) {
    if (!path) {
        return '';
    }

    try {
        const absoluteUrl = new URL(path);
        if (absoluteUrl.protocol === 'http:' || absoluteUrl.protocol === 'https:') {
            return path;
        }
    } catch (err) {
        // Ignore parse errors; the path is relative.
    }

    const normalizedPath = path.replace(/^\/+/, '');

    if (!assetBaseUrl) {
        return normalizedPath;
    }

    try {
        return new URL(normalizedPath, assetBaseUrl).toString();
    } catch (err) {
        console.warn('組合資源 URL 時發生錯誤，將改用原始路徑:', err);
        return normalizedPath;
    }
}

async function decompressBase64WithCache(base64) {
    if (typeof base64 !== 'string' || !base64) {
        return '';
    }

    const cacheKey = `$default:${base64}`;

    if (decompressCache.has(cacheKey)) {
        const cached = decompressCache.get(cacheKey);
        return typeof cached === 'string' ? cached : cached;
    }

    const request = window.CompressionHelper?.decompressFromBase64
        ? window.CompressionHelper.decompressFromStorableString(base64)
            .then(result => {
                decompressCache.set(cacheKey, result);
                return result;
            })
            .catch(err => {
                decompressCache.delete(cacheKey);
                throw err;
            })
        : Promise.reject(new Error('瀏覽器不支援解壓縮功能'));

    decompressCache.set(cacheKey, request);
    return request;
}


const DEFAULT_SCRIPT = 'trouble_brewing.json';
const LOCAL_STORAGE_CONFIG_KEY = 'botc_overlay_last_config_v1';
const LOCAL_STORAGE_SCRIPT_KEY = 'botc_overlay_last_script_v1';

const decompressCache = new Map();

let referenceDataPromise = null;

const TEAM_ALIASES = {
    townsfolk: 'townsfolk',
    townfolk: 'townsfolk',
    outsiders: 'outsider',
    outsider: 'outsider',
    minions: 'minion',
    minion: 'minion',
    demons: 'demon',
    demon: 'demon',
    'a jinxed': 'a jinxed',
    'a_jinxed': 'a jinxed',
    jinxed: 'a jinxed',
    jinx: 'a jinxed'
};

const CHINESE_TEAM_ALIASES = {
    鎮民: 'townsfolk',
    镇民: 'townsfolk',
    外來者: 'outsider',
    外来者: 'outsider',
    爪牙: 'minion',
    惡魔: 'demon',
    恶魔: 'demon',
    相剋: 'a jinxed',
    相克: 'a jinxed'
};

function normalizeTeam(rawTeam, rawChineseTeam) {
    if (rawTeam) {
        const key = String(rawTeam).trim().toLowerCase();
        if (key in TEAM_ALIASES) {
            return TEAM_ALIASES[key];
        }
    }

    if (rawChineseTeam) {
        const key = String(rawChineseTeam).trim();
        if (key in CHINESE_TEAM_ALIASES) {
            return CHINESE_TEAM_ALIASES[key];
        }
    }

    return null;
}

function normalizeImageUrl(raw) {
    if (!raw) {
        return '';
    }

    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) {
        if (raw.startsWith('//')) {
            return `${window.location.protocol}${raw}`;
        }
        return raw;
    }

    return resolveAssetUrl(raw);
}

function showTooltipForElement(element, text, direction) {
    if (!globalTooltip) {
        return;
    }

    const tooltipText = text || '（沒有能力資訊）';
    globalTooltip.textContent = tooltipText;
    globalTooltip.style.display = 'block';

    const rect = element.getBoundingClientRect();
    const tooltipWidth = globalTooltip.offsetWidth;
    const horizontalPadding = 10;
    const offsetY = rect.top + window.scrollY;

    let offsetX;
    if (direction === 'left') {
        offsetX = Math.max(horizontalPadding, rect.left - tooltipWidth - horizontalPadding);
    } else {
        offsetX = Math.min(
            window.innerWidth - tooltipWidth - horizontalPadding,
            rect.right + horizontalPadding
        );
    }

    globalTooltip.style.left = `${offsetX}px`;
    globalTooltip.style.top = `${offsetY}px`;
}

function hideTooltip() {
    if (globalTooltip) {
        globalTooltip.style.display = 'none';
    }
}

function attachTooltip(element, text, direction) {
    if (!element) {
        return;
    }

    const tooltipText = text || '（沒有能力資訊）';
    element.addEventListener('mouseenter', () => {
        showTooltipForElement(element, tooltipText, direction);
    });
    element.addEventListener('mouseleave', hideTooltip);
}

function parseActionOrder(raw) {
    if (raw === null || raw === undefined) {
        return null;
    }

    if (typeof raw === 'string' && raw.trim() === '') {
        return null;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) {
        return null;
    }

    return value;
}

function renderOrderList(container, entries, tooltipDirection) {
    if (!container) {
        return;
    }

    container.innerHTML = '';

    const sorted = entries
        .filter(entry => entry && typeof entry.value === 'number')
        .sort((a, b) => a.value - b.value);

    sorted.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'order-item';

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'order-icon';

        if (entry.image) {
            const img = document.createElement('img');
            img.src = entry.image;
            img.alt = entry.name;
            iconWrapper.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'order-icon-placeholder';
            const fallbackText = entry.placeholder || (entry.name ? entry.name.charAt(0) : '★');
            placeholder.textContent = fallbackText;
            iconWrapper.appendChild(placeholder);
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'order-name';
        nameSpan.textContent = entry.name;

        item.appendChild(iconWrapper);
        item.appendChild(nameSpan);

        attachTooltip(item, entry.tooltip, tooltipDirection);

        container.appendChild(item);
    });
}

function getReferenceMap() {
    if (!referenceDataPromise) {
        const referenceListPath = 'new_EVERY_SINGLE_ROLE_with_chinese_abilities.json';
        const referenceListUrl = assetBaseUrl
            ? new URL(referenceListPath, assetBaseUrl).toString()
            : referenceListPath;
        referenceDataPromise = fetch(referenceListUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(list => {
                const map = new Map();
                if (Array.isArray(list)) {
                    list.forEach(item => {
                        if (item && item.id) {
                            map.set(item.id, item);
                        }
                    });
                }
                return map;
            })
            .catch(err => {
                console.error('載入角色資料參考表失敗:', err);
                return new Map();
            });
    }

    return referenceDataPromise;
}

function updateCategoryTitles(meta) {
    const metaNames = meta || {};
    const titleMap = {
        townsfolk: metaNames.townsfolkName || metaNames.townsfolk || CATEGORY_DEFAULT_NAMES.townsfolk,
        outsider: metaNames.outsidersName || metaNames.outsider || CATEGORY_DEFAULT_NAMES.outsider,
        minion: metaNames.minionsName || metaNames.minion || CATEGORY_DEFAULT_NAMES.minion,
        demon: metaNames.demonsName || metaNames.demon || CATEGORY_DEFAULT_NAMES.demon,
        'a jinxed': metaNames['a jinxedName'] || metaNames['a jinxed'] || CATEGORY_DEFAULT_NAMES['a jinxed']
    };

    Object.entries(categoryElements).forEach(([key, { title }]) => {
        if (title) {
            title.textContent = titleMap[key] || CATEGORY_DEFAULT_NAMES[key] || '';
        }
    });
}

function togglePanels() {
    isVisible = !isVisible;
    if (leftPanel) {
        leftPanel.classList.toggle('show', isVisible);
    }
    if (rightPanel) {
        rightPanel.classList.toggle('show', isVisible);
    }
    if (!isVisible) {
        hideTooltip();
    }
}

if (toggleButton && !isMobileLayout) {
    toggleButton.addEventListener('click', togglePanels);
}

async function resolveCustomScript(config, resolvedScript) {
    if (typeof resolvedScript === 'string' && resolvedScript) return resolvedScript;
    if (!config || typeof config !== 'object') return '';

    // 🟦 新增分段支援：合併 global 段
    if (config.hasGlobalPart) {
        try {
            const globalStr = window.Twitch?.ext?.configuration?.global?.content || '{}';
            const globalData = JSON.parse(globalStr);
            const merged = (config.compressedBase64 || '') + (globalData.compressedBase64 || '');
            return await decompressBase64WithCache(merged);
        } catch (err) {
            console.warn('解析或合併 global 段失敗，改嘗試 broadcaster 段:', err);
        }
    }

    // 🟩 單段壓縮
    if (typeof config.compressedBase64 === 'string' && config.compressedBase64.trim()) {
        try {
            return await decompressBase64WithCache(config.compressedBase64);
        } catch (err) {
            console.warn('單段解壓失敗，改嘗試未壓縮資料:', err);
        }
    }

    return '';
}

function computeConfigSignature(config, resolvedScript) {
    if (!config || typeof config !== 'object') return 'default';

    const selectedScript = config.selectedScript || null;
    const scriptVersion = config.scriptVersion || config._timestamp || null;
    const scriptHash = config.scriptHash || null;

    // 原始 JSON 長度：以 customJsonLength 為主，沒有時才用解壓後字串長度
    const customLength =
        typeof config.customJsonLength === 'number'
            ? config.customJsonLength
            : (typeof resolvedScript === 'string' ? resolvedScript.length : null);

    const hasGlobalPart = !!config.hasGlobalPart;

    // 只輸出目前存在且必要的欄位
    return JSON.stringify({
        selectedScript,
        scriptVersion,
        scriptHash,
        customLength,
        hasGlobalPart
    });
}

function prepareConfigForStorage(config) {
    // 基本防呆
    if (!config || typeof config !== 'object') return null;

    // 只拷貝「需要用來判斷是否變更」的欄位
    const stored = {
        // 共同欄位
        selectedScript: config.selectedScript || '',
        _timestamp: typeof config._timestamp === 'number' ? config._timestamp : null,

        // 版本/簽章相關（上傳端已先計算好，不要在這裡再推導）
        scriptVersion: typeof config.scriptVersion === 'number' ? config.scriptVersion : (config._timestamp || null),
        scriptHash: config.scriptHash || null,

        // 自訂劇本才有意義的欄位（供 overlay 計算簽章用）
        customName: config.customName || '',
        customJsonLength: typeof config.customJsonLength === 'number' ? config.customJsonLength : null,

        // 是否有分段（broadcaster + global）
        hasGlobalPart: !!config.hasGlobalPart
    };

    // 內建劇本：移除自訂劇本專屬欄位
    if (stored.selectedScript !== '__custom__') {
        delete stored.customName;
        delete stored.scriptHash;
        delete stored.customJsonLength;
        delete stored.hasGlobalPart;
    }

    return stored;
}

function loadStoredViewerState() {
    try {
        const configStr = window.localStorage?.getItem(LOCAL_STORAGE_CONFIG_KEY);
        if (!configStr) {
            return null;
        }

        const config = JSON.parse(configStr);
        const scriptSource = window.localStorage?.getItem(LOCAL_STORAGE_SCRIPT_KEY) || null;
        return { config, scriptSource };
    } catch (err) {
        console.warn('載入最近的覆蓋設定時發生錯誤:', err);
        return null;
    }
}

function persistViewerState(config, scriptSource) {
    try {
        if (!config) {
            window.localStorage?.removeItem(LOCAL_STORAGE_CONFIG_KEY);
            window.localStorage?.removeItem(LOCAL_STORAGE_SCRIPT_KEY);
            return;
        }

        const storedConfig = prepareConfigForStorage(config);
        if (storedConfig) {
            window.localStorage?.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(storedConfig));
        }

        if (typeof scriptSource === 'string' && scriptSource.trim()) {
            window.localStorage?.setItem(LOCAL_STORAGE_SCRIPT_KEY, scriptSource);
        } else {
            window.localStorage?.removeItem(LOCAL_STORAGE_SCRIPT_KEY);
        }
    } catch (err) {
        console.warn('儲存最近覆蓋設定至本機時發生錯誤:', err);
    }
}

async function loadRolesFromList(roleList) {
    if (!Array.isArray(roleList)) {
        throw new Error('角色資料格式不正確');
    }

    let meta = null;
    const playableRoles = [];

    roleList.forEach(entry => {
        if (!entry || typeof entry !== 'object') {
            return;
        }

        if (entry.id === '_meta') {
            meta = entry;
            return;
        }

        if (entry.id) {
            playableRoles.push(entry);
        }
    });

    updateCategoryTitles(meta);

    const referenceMap = await getReferenceMap();

    Object.values(categoryElements).forEach(({ grid }) => {
        if (grid) {
            grid.innerHTML = '';
        }
    });

    if (firstNightList) {
        firstNightList.innerHTML = '';
    }

    if (otherNightList) {
        otherNightList.innerHTML = '';
    }

    hideTooltip();

    const firstNightEntries = [];
    const otherNightEntries = [];

    playableRoles.forEach(role => {
        const reference = (role.id && referenceMap.get(role.id)) || null;
        const combined = { ...(reference || {}), ...role };
        const team = normalizeTeam(
            combined.team,
            role.sch_team || combined.sch_team || reference?.sch_team
        );

        if (!team || !categoryElements[team]) {
            return;
        }

        const displayName = combined.name ?? reference?.name_zh ?? reference?.name ?? role.id;
        const ability = (typeof combined.ability === 'string' && combined.ability.trim())
            ? combined.ability
            : (reference?.ability || '');
        const imageUrl = normalizeImageUrl(combined.image ?? reference?.image ?? '');
        const firstNightReminder =
            typeof combined.firstNightReminder === 'string' && combined.firstNightReminder.trim()
                ? combined.firstNightReminder.trim()
                : '';
        const otherNightReminder =
            typeof combined.otherNightReminder === 'string' && combined.otherNightReminder.trim()
                ? combined.otherNightReminder.trim()
                : '';
        const tooltipDirection = team === 'townsfolk' ? 'right' : 'left';

        const container = document.createElement('div');
        container.className = 'role';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = displayName;
        container.appendChild(img);

        const label = document.createElement('div');
        label.className = 'role-label';
        label.textContent = displayName;
        container.appendChild(label);

        const tooltipText = ability || '（沒有能力資訊）';
        attachTooltip(container, tooltipText, tooltipDirection);

        categoryElements[team].grid.appendChild(container);

        const firstNightValue = parseActionOrder(combined.firstNight);
        if (firstNightValue !== null) {
            const reminderText = firstNightReminder || '（沒有提醒）';
            firstNightEntries.push({
                value: firstNightValue,
                name: displayName,
                image: imageUrl,
                tooltip: reminderText
            });
        }

        const otherNightValue = parseActionOrder(combined.otherNight);
        if (otherNightValue !== null) {
            const reminderText = otherNightReminder || '（沒有提醒）';
            otherNightEntries.push({
                value: otherNightValue,
                name: displayName,
                image: imageUrl,
                tooltip: reminderText
            });
        }
    });

    renderOrderList(firstNightList, firstNightEntries, 'right');
    renderOrderList(otherNightList, otherNightEntries, 'left');
}

async function loadDefaultScript() {
    const defaultScriptUrl = resolveAssetUrl(`Allscript/${DEFAULT_SCRIPT}`);

    try {
        const data = await fetch(defaultScriptUrl).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        });
        await loadRolesFromList(data);
    } catch (err) {
        console.error('載入預設劇本失敗:', err);
    }
}

async function loadScriptByName(scriptFileName) {
    const scriptUrl = resolveAssetUrl(`Allscript/${scriptFileName}`);

    try {
        const data = await fetch(scriptUrl).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        });
        await loadRolesFromList(data);
    } catch (err) {
        console.warn(`載入指定劇本失敗 (${scriptFileName})，改用預設劇本。`, err);
        await loadDefaultScript();
    }
}

async function applyConfig(config, options = {}) {
    const { force = false, resolvedScript = null, allowDefault = true } = options;

    const signature = computeConfigSignature(config, resolvedScript);
    if (!force && signature === lastAppliedSignature) {
        return { applied: false, scriptSource: null };
    }

    if (!config || typeof config !== 'object') {
        if (!allowDefault) {
            return { applied: false, scriptSource: null };
        }

        await loadDefaultScript();
        lastAppliedSignature = 'default';
        return { applied: true, scriptSource: null };
    }

    if (config.selectedScript === '__custom__') {
        let scriptSource = '';
        try {
            scriptSource = await resolveCustomScript(config, resolvedScript);
        } catch (err) {
            console.error('解壓縮自訂劇本失敗，改用預設劇本:', err);
            if (allowDefault) {
                await loadDefaultScript();
                lastAppliedSignature = 'default';
                return { applied: true, scriptSource: null };
            }
            return { applied: false, scriptSource: null };
        }

        if (!scriptSource) {
            console.warn('自訂劇本為空，改用預設劇本');
            if (allowDefault) {
                await loadDefaultScript();
                lastAppliedSignature = 'default';
                return { applied: true, scriptSource: null };
            }
            return { applied: false, scriptSource: null };
        }

        try {
            const customList = JSON.parse(scriptSource);
            await loadRolesFromList(customList);
            lastAppliedSignature = signature;
            return { applied: true, scriptSource };
        } catch (err) {
            console.error('解析自訂劇本失敗，改用預設劇本:', err);
            if (allowDefault) {
                await loadDefaultScript();
                lastAppliedSignature = 'default';
                return { applied: true, scriptSource: null };
            }
            return { applied: false, scriptSource: null };
        }
    }

    if (config.selectedScript) {
        await loadScriptByName(config.selectedScript);
        lastAppliedSignature = signature;
        return { applied: true, scriptSource: null };
    }

    if (allowDefault) {
        await loadDefaultScript();
        lastAppliedSignature = signature;
        return { applied: true, scriptSource: null };
    }

    return { applied: false, scriptSource: null };
}

async function applyFallbackConfig() {
    const storedState = loadStoredViewerState();
    if (storedState) {
        const result = await applyConfig(storedState.config, {
            force: true,
            resolvedScript: storedState.scriptSource,
            allowDefault: true
        });

        if (result.applied) {
            if (!result.scriptSource && storedState.scriptSource) {
                persistViewerState(null, null);
            }
            return;
        }

        persistViewerState(null, null);
    }

    await applyConfig(null, { force: true });
}

async function handleTwitchConfigChange() {
    const configStr = window.Twitch?.ext?.configuration?.broadcaster?.content;
    if (!configStr) {
        persistViewerState(null, null);
        await applyFallbackConfig();
        return;
    }

    try {
        const config = JSON.parse(configStr);
        if (!config || Object.keys(config).length === 0) {
            persistViewerState(null, null);
            await applyFallbackConfig();
            return;
        }

        const result = await applyConfig(config, { force: true });
        if (result.applied) {
            persistViewerState(config, result.scriptSource);
        }
    } catch (err) {
        console.error('解析 Twitch 設定錯誤，改用本機或預設劇本:', err);
        await applyFallbackConfig();
    }
}

function setupTwitchIntegration() {
    const twitchExt = window.Twitch?.ext;
    if (!twitchExt) {
        return false;
    }

    const safeTrigger = () => {
        if (!twitchAuthorized) {
            return;
        }

        handleTwitchConfigChange().catch(err => {
            console.error('處理 Twitch 設定時發生錯誤:', err);
        });
    };

    twitchExt.onAuthorized(() => {
        twitchAuthorized = true;
        safeTrigger();
    });

    if (twitchExt.configuration?.onChanged) {
        twitchExt.configuration.onChanged(() => {
            safeTrigger();
        });
    }

    if (twitchExt.listen) {
        twitchExt.listen('broadcast', (target, contentType, body) => {
            if (target !== 'broadcast' || !body) {
                return;
            }

            try {
                const parsed = typeof body === 'string' ? JSON.parse(body) : body;
                if (!parsed || typeof parsed !== 'object') {
                    return;
                }

                twitchAuthorized = true;
                applyConfig(parsed, { force: true }).then(result => {
                    if (result.applied) {
                        persistViewerState(parsed, result.scriptSource);
                    }
                }).catch(err => {
                    console.error('套用 Twitch 廣播設定時發生錯誤:', err);
                });
            } catch (err) {
                console.warn('解析 Twitch 廣播設定時發生錯誤:', err);
            }
        });
    }

    return true;
}

async function init() {
    const hasTwitch = setupTwitchIntegration();

    await applyFallbackConfig();

    if (!hasTwitch) {
        return;
    }

    // 如果在合理時間內沒有取得授權，繼續沿用本機或預設設定
    setTimeout(() => {
        if (!twitchAuthorized) {
            console.warn('未從 Twitch 取得授權回應，沿用本機設定或預設劇本。');
            applyFallbackConfig().catch(err => {
                console.warn('套用本機設定時發生錯誤:', err);
            });
        }
    }, 5000);
}

init();
