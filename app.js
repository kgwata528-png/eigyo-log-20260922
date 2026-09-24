const GOOGLE_MAPS_API_KEY = 'AIzaSyDAjCfUJJTzLI2Z8RwLW_O7QGwTO_6mO9U';

// ── データバージョン管理（アップデートしてもデータが消えない） ──
const DATA_VERSION = '1';
function migrateData() {
  const ver = localStorage.getItem('dataVersion');
  if (ver !== DATA_VERSION) {
    // 既存データは保持したままバージョンだけ更新
    localStorage.setItem('dataVersion', DATA_VERSION);
  }
}
migrateData();

function loadRecords() { try { return JSON.parse(localStorage.getItem('visitRecords') || '[]'); } catch { return []; } }
function saveRecords(r) { try { localStorage.setItem('visitRecords', JSON.stringify(r)); } catch(e) {} }
function loadCounters() {
  const today = new Date().toDateString();
  try {
    const d = JSON.parse(localStorage.getItem('counters') || '{}');
    return d.date === today ? d : { date: today, absent: 0, intercom: 0, face: 0 };
  } catch { return { date: today, absent: 0, intercom: 0, face: 0 }; }
}
function saveCounters(c) { try { localStorage.setItem('counters', JSON.stringify(c)); } catch(e) {} }
function loadTrail() { try { return JSON.parse(localStorage.getItem('trail') || '[]'); } catch { return []; } }
function saveTrail(t) { try { localStorage.setItem('trail', JSON.stringify(t)); } catch(e) {} }

let records = loadRecords();
let counters = loadCounters();
let trail = loadTrail();

// ── タブ ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'history') renderHistory();
    if (tab === 'folders') renderFolderList();
    if (tab === 'map' && !mapInitialized) initMap();
  });
});

// ── カウンター ──
function renderCounters() {
  document.getElementById('cnt-absent').textContent = counters.absent;
  document.getElementById('cnt-intercom').textContent = counters.intercom;
  document.getElementById('cnt-face').textContent = counters.face;
  document.getElementById('cnt-total').textContent = counters.absent + counters.intercom + counters.face;
}
function bump(type, delta) {
  counters[type] = Math.max(0, counters[type] + delta);
  saveCounters(counters);
  renderCounters();
  if (delta > 0) {
    const el = document.getElementById('cnt-' + type);
    el.style.transition = 'transform 0.1s';
    el.style.transform = 'scale(1.3)';
    setTimeout(() => { el.style.transform = ''; }, 130);
  }
}
function resetCounter() {
  if (!confirm('本日のカウントをリセットしますか？')) return;
  counters = { date: new Date().toDateString(), absent: 0, intercom: 0, face: 0 };
  saveCounters(counters);
  renderCounters();
}
renderCounters();

// ── 月次統計 ──
let statsMonth = new Date(); // 表示中の月

function shiftMonth(delta) {
  statsMonth = new Date(statsMonth.getFullYear(), statsMonth.getMonth() + delta, 1);
  renderMonthlyStats();
}

function renderMonthlyStats() {
  const y = statsMonth.getFullYear();
  const m = statsMonth.getMonth();
  const label = `${y}年${m + 1}月の統計`;
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();
  document.getElementById('monthly-title').textContent = isCurrentMonth ? '今月の統計' : label;

  // recordsの日付は「M/D」形式なので月を判定
  const monthRecs = records.filter(r => {
    if (!r.date) return false;
    // timestamp優先
    if (r.timestamp) {
      const d = new Date(r.timestamp);
      return d.getFullYear() === y && d.getMonth() === m;
    }
    // dateが「M/D」の場合は現在年で判定
    const parts = r.date.replace(/[年月\/]/g, '/').split('/');
    if (parts.length >= 2) {
      const rm = parseInt(parts[0]) - 1;
      return rm === m && y === now.getFullYear();
    }
    return false;
  });

  const total = monthRecs.length;
  const firstVisit = monthRecs.filter(r => r.visit === '初訪').length;
  const revisit = monthRecs.filter(r => r.visit === '再訪').length;
  const face = monthRecs.filter(r => r.response === '対面').length;
  const intercom = monthRecs.filter(r => r.response === 'インターホン').length;
  const absent = monthRecs.filter(r => r.response === '不在').length;

  document.getElementById('m-total').textContent = total;
  document.getElementById('m-first').textContent = firstVisit;
  document.getElementById('m-revisit').textContent = revisit;

  const faceRate = total ? Math.round(face / total * 100) : 0;
  const intercomRate = total ? Math.round(intercom / total * 100) : 0;
  const absentRate = total ? Math.round(absent / total * 100) : 0;

  document.getElementById('m-face-rate').textContent = `${faceRate}%`;
  document.getElementById('m-intercom-rate').textContent = `${intercomRate}%`;
  document.getElementById('m-absent-rate').textContent = `${absentRate}%`;
  document.getElementById('m-face-bar').style.width = `${faceRate}%`;
  document.getElementById('m-intercom-bar').style.width = `${intercomRate}%`;
  document.getElementById('m-absent-bar').style.width = `${absentRate}%`;
}

// カウンタータブを開いた時に統計を更新
document.querySelectorAll('.nav-btn').forEach(btn => {
  const origClick = btn.onclick;
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'counter') setTimeout(renderMonthlyStats, 50);
  });
});
setTimeout(renderMonthlyStats, 100);

// ── セグメント ──
document.querySelectorAll('[id^="seg-"], [id^="eseg-"]').forEach(group => {
  group.querySelectorAll('.seg').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.seg').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
function getSelected(groupId) {
  const el = document.querySelector('#' + groupId + ' .seg.active');
  return el ? el.dataset.val : '';
}
function setSelected(groupId, val) {
  document.querySelectorAll('#' + groupId + ' .seg').forEach(s => {
    s.classList.toggle('active', s.dataset.val === val);
  });
}

// ── 現在地取得（Google Geocoding API） ──
let lastLatLng = null;
function getLocation() {
  const status = document.getElementById('geo-status');
  if (!navigator.geolocation) { 
    status.textContent = '位置情報が使用できません'; 
    console.error('Geolocation API非対応');
    return; 
  }
  status.textContent = '取得中…';
  
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    lastLatLng = { lat, lng };
    status.textContent = '住所を変換中…';
    console.log('取得した緯度経度:', lat, lng);
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ja&key=${GOOGLE_MAPS_API_KEY}`;
    console.log('リクエストURL:', url);

    try {
      const res = await fetch(url);
      console.log('レスポンスStatus:', res.status, res.statusText);
      
      const d = await res.json();
      console.log('APIレスポンスデータ:', d);
      
      if (d.status === 'OK' && d.results.length > 0) {
        const addr = d.results[0].formatted_address
          .replace('日本、', '')
          .replace(/〒\d{3}-\d{4}\s*/, '');
        document.getElementById('inp-address').value = addr;
        status.textContent = '✓ 取得しました';
        setTimeout(() => { status.textContent = ''; }, 2000);
        checkDuplicate();
      } else {
        status.textContent = `APIエラー: ${d.status}`;
        console.error('Geocoding失敗 ステータス:', d.status, d.error_message);
      }
    } catch (err) {
      status.textContent = '通信エラー（catch）が発生しました';
      console.error('fetch例外エラー:', err);
    }
  }, (geoErr) => {
    status.textContent = `位置情報取得失敗: ${geoErr.message}`;
    console.error('GPS取得エラー:', geoErr);
  },
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
}

// ── 重複チェック ──
function norm(s) {
  return (s || '')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // 全角数字→半角
    .replace(/[\s　]/g, '')
    .toLowerCase();
}
// ── 入力中のリアルタイム重複・候補検索 ──
// ── 入力中のリアルタイム重複・候補検索（複数表示版） ──
function checkDuplicate() {
  const nameInput = document.getElementById('inp-name');
  const addressInput = document.getElementById('inp-address');
  const dupeBanner = document.getElementById('dupe-banner');
  const dupeList = document.getElementById('dupe-list');

  if (!dupeBanner || !dupeList) return;

  const nameVal = nameInput ? nameInput.value.trim() : '';
  const addrVal = addressInput ? addressInput.value.trim() : '';

  // どちらも空なら候補欄を隠す
  if (!nameVal && !addrVal) {
    dupeBanner.style.display = 'none';
    dupeList.innerHTML = '';
    return;
  }

  // 過去の記録から検索
  const recs = window.records || JSON.parse(localStorage.getItem('sales_records') || '[]');
  
  // 名前 または 住所 が一致する顧客をすべて抽出
  const matches = recs.filter(r => {
    const matchName = nameVal !== '' && r.name && r.name.includes(nameVal);
    const matchAddr = addrVal !== '' && r.address && r.address.includes(addrVal);
    return matchName || matchAddr;
  });

  if (matches.length === 0) {
    dupeBanner.style.display = 'none';
    dupeList.innerHTML = '';
    return;
  }

  // 候補を表示（該当するものを最大5件まで並べて表示）
  dupeBanner.style.display = 'block';
  dupeList.innerHTML = matches.slice(0, 5).map(item => `
    <div onclick="selectDuplicateCandidate('${item.id}')" style="padding: 10px; background: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; margin-top: 6px; cursor: pointer;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="font-weight: bold; font-size: 14px; color: #333;">${item.name || '名前未入力'} 様</div>
        <span style="background: #f0f0f0; color: #555; padding: 2px 6px; border-radius: 4px; font-size: 11px;">ランク ${item.rank || 'E'}</span>
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 2px;">📍 ${item.address || '住所未入力'}</div>
      <div style="font-size: 11px; color: #1a73e8; margin-top: 4px;">タップして「再訪」としてセット</div>
    </div>
  `).join('');
}

// ── 候補をタップしたときに自動入力する処理 ──
// ── 候補をタップしたときに自動入力する処理 ──
function selectDuplicateCandidate(id) {
  const recs = window.records || JSON.parse(localStorage.getItem('sales_records') || '[]');
  const target = recs.find(r => String(r.id) === String(id));
  if (!target) return;

  // 1. 名前・住所を入力欄にセット
  const nameInput = document.getElementById('inp-name');
  const addressInput = document.getElementById('inp-address');
  if (nameInput) nameInput.value = target.name !== '名前未入力' ? target.name : '';
  if (addressInput) addressInput.value = target.address !== '住所未入力' ? target.address : '';

  // 2. 訪問種別を「再訪」に変更
  const visitSegs = document.querySelectorAll('#seg-visit .seg');
  visitSegs.forEach(btn => {
    if (btn.getAttribute('data-val') === '再訪') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 3. 最新ランクをセット
  if (target.rank) {
    const rankSegs = document.querySelectorAll('#seg-rank .seg');
    rankSegs.forEach(btn => {
      if (btn.getAttribute('data-val') === target.rank) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 4. メモ欄をクリアして新規入力へ
  const memoInput = document.getElementById('inp-memo');
  if (memoInput) memoInput.value = '';

  // ★ 既存の顧客IDを保持（保存時にこの顧客へメモを追加するため）
  window.selectedCustomerId = target.id;

  // 候補バナーを閉じる
  const dupeBanner = document.getElementById('dupe-banner');
  if (dupeBanner) dupeBanner.style.display = 'none';
}

function renderCustomerList() {
  const container = document.getElementById('customer-list-container');
  if (!container) return;

  const recs = JSON.parse(localStorage.getItem('sales_records') || '[]');

  container.innerHTML = recs.map(cust => {
    const memoList = cust.memos || [];
    const memoCount = memoList.length;

    // ★ メモ群を縦一列（1行1メモ）で作成
    const memosHtml = memoList.map(m => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid #f0f0f0;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden;">
          <span style="color: #888; font-size: 12px; white-space: nowrap;">${m.time}</span>
          <span style="background: #f1f3f4; color: #3c4043; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px; white-space: nowrap;">
            ${m.type}
          </span>
          <span style="color: #333; font-size: 13px; word-break: break-all;">${m.text}</span>
        </div>
        <div style="display: flex; gap: 4px; margin-left: 8px; flex-shrink: 0;">
          <button onclick="editMemo('${cust.id}', '${m.id}')" style="background: #e8f0fe; color: #1a73e8; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">編集</button>
          <button onclick="deleteMemo('${cust.id}', '${m.id}')" style="background: #fce8e6; color: #c5221f; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">削除</button>
        </div>
      </div>
    `).join('');

    return `
      <div style="background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <!-- 顧客情報ヘッダー -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px;">
          <div>
            <h3 style="margin: 0; font-size: 16px; color: #202124;">${cust.name}</h3>
            <p style="margin: 4px 0 0; font-size: 12px; color: #5f6368;">${cust.address}</p>
          </div>
          <div style="text-align: right;">
            <span style="background: ${getRankColor(cust.rank)}; color: #fff; font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 11px;">
              ランク ${cust.rank}
            </span>
            <div style="font-size: 11px; color: #70757a; margin-top: 4px;">計 ${memoCount} 回</div>
          </div>
        </div>

        <!-- ★ 縦並びのメモ群（最新が一番上） -->
        <div style="display: flex; flex-direction: column; margin-top: 4px;">
          ${memosHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ランク別の色を返すユーティリティ
function getRankColor(rank) {
  switch (rank) {
    case 'A': return '#1a73e8';
    case 'B': return '#fbbc04'; // 画像の黄色系[cite: 1]
    case 'C': return '#ea4335'; // 画像の赤系[cite: 1]
    default: return '#70757a';
  }
}


// ── 改善版 saveRecord ──
async function saveRecord() {
  console.log('保存処理開始');
  
  try {
    const nameInput = document.getElementById('inp-name');
    const addressInput = document.getElementById('inp-address');
    const memoInput = document.getElementById('inp-memo');
    const btn = document.getElementById('save-btn');

    const name = nameInput ? nameInput.value.trim() : '';
    const address = addressInput ? addressInput.value.trim() : '';

    if (!name && !address) { 
      alert('名前または住所を入力してください'); 
      return; 
    }

    // ランクの取得
    let selectedRank = '';
    const activeRankBtn = document.querySelector('#seg-rank .active, [data-seg="seg-rank"].active');
    if (activeRankBtn) {
      selectedRank = activeRankBtn.dataset.val || activeRankBtn.textContent.trim();
    }
    if (!selectedRank && typeof getSelected === 'function') {
      try { selectedRank = getSelected('seg-rank'); } catch(e){}
    }
    if (!selectedRank) selectedRank = 'E';

    // 訪問種別（応答）の取得（例: 対面、不在、インターホンなど）
    const visitResponse = (typeof getSelected === 'function' ? getSelected('seg-response') : null) || '対面';

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    const recName = name || '名前未入力';
    const recAddress = address || '住所未入力';
    const memoText = memoInput ? memoInput.value.trim() : '';

    if (!window.records || !Array.isArray(window.records)) {
      window.records = (typeof records !== 'undefined' && Array.isArray(records)) ? records : [];
    }

    // ★今回の新しいメモオブジェクト
    const newMemoObj = {
      id: Date.now().toString(),
      date: dateStr,
      response: visitResponse,
      text: memoText
    };

    // 同一顧客の存在チェック（「候補タップ」または「完全同名・同住所」）
    let existingIndex = -1;
    if (window.selectedCandidateId) {
      existingIndex = window.records.findIndex(r => String(r.id) === String(window.selectedCandidateId));
    }
    if (existingIndex === -1 && name && address) {
      existingIndex = window.records.findIndex(r => r.name === recName && r.address === recAddress);
    }

    if (existingIndex !== -1) {
      // ── 【既存顧客の更新】 ──
      const oldRec = window.records[existingIndex];
      
      // 既存のメモ配列を取得（旧形式の文字列メモがある場合は配列に変換して吸収）
      let currentMemos = Array.isArray(oldRec.memos) ? oldRec.memos : [];
      if (!Array.isArray(oldRec.memos) && oldRec.memo) {
        currentMemos = [{ id: 'old-1', date: oldRec.date || dateStr, response: oldRec.response || '対面', text: oldRec.memo }];
      }

      // ★ 最新のメモを「配列の先頭（unshift）」に追加して一番上に表示されるようにする
      if (memoText) {
        currentMemos.unshift(newMemoObj);
      }

      window.records[existingIndex] = {
        ...oldRec,
        date: dateStr, // 最新の活動日時
        timestamp: Date.now(),
        visit: (typeof getSelected === 'function' ? getSelected('seg-visit') : null) || '再訪',
        response: visitResponse,
        rank: selectedRank, // 最新ランクに更新
        memos: currentMemos, // ★ 配列化されたメモ群
        lat: (typeof lastLatLng !== 'undefined' && lastLatLng) ? lastLatLng.lat : oldRec.lat,
        lng: (typeof lastLatLng !== 'undefined' && lastLatLng) ? lastLatLng.lng : oldRec.lng,
      };
    } else {
      // ── 【完全新規顧客の追加】 ──
      const newRec = {
        id: Date.now().toString(),
        date: dateStr,
        timestamp: Date.now(),
        visit: (typeof getSelected === 'function' ? getSelected('seg-visit') : null) || '初訪',
        response: visitResponse,
        rank: selectedRank,
        name: recName,
        address: recAddress,
        memos: memoText ? [newMemoObj] : [], // ★ メモ配列として保持
        lat: typeof lastLatLng !== 'undefined' && lastLatLng ? lastLatLng.lat : null,
        lng: typeof lastLatLng !== 'undefined' && lastLatLng ? lastLatLng.lng : null,
      };
      window.records.unshift(newRec);
    }

    // 同期して LocalStorage へ書き込み
    records = window.records;
    try {
      localStorage.setItem('sales_records', JSON.stringify(window.records));
    } catch (e) {
      console.error('LocalStorage Save Error:', e);
    }

    // フォームリセット
    if (nameInput) nameInput.value = '';
    if (addressInput) addressInput.value = '';
    if (memoInput) memoInput.value = '';
    if (typeof lastLatLng !== 'undefined') lastLatLng = null;
    window.selectedCandidateId = null;

    const dupeBanner = document.getElementById('dupe-banner');
    if (dupeBanner) dupeBanner.style.display = 'none';

    if (btn) {
      btn.textContent = '✓ 保存しました';
      setTimeout(() => { btn.textContent = '保存する'; }, 1500);
    }

    // 描画・地図描画更新
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof addVisitMarker === 'function') {
      const targetRec = existingIndex !== -1 ? window.records[existingIndex] : window.records[0];
      if (targetRec.lat && targetRec.lng) addVisitMarker(targetRec);
    }

  } catch (err) {
    alert('保存処理中にエラーが発生しました: ' + err.message);
  }
}


// ── 編集・削除 ──
function openEdit(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-name').value = rec.name;
  document.getElementById('edit-address').value = rec.address;
  document.getElementById('edit-memo').value = rec.memo || '';
  setSelected('eseg-response', rec.response);
  setSelected('eseg-rank', rec.rank);
  setSelected('eseg-visit', rec.visit);
  document.getElementById('edit-modal').classList.add('open');
}
function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
}
function confirmEdit() {
  const id = parseInt(document.getElementById('edit-id').value);
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return;
  records[idx] = {
    ...records[idx],
    name: document.getElementById('edit-name').value.trim() || records[idx].name,
    address: document.getElementById('edit-address').value.trim() || records[idx].address,
    memo: document.getElementById('edit-memo').value.trim(),
    response: getSelected('eseg-response'),
    rank: getSelected('eseg-rank'),
    visit: getSelected('eseg-visit'),
  };
  syncPersonRank(records[idx].name, records[idx].address, records[idx].rank);
  saveRecords(records);
  closeModal();
  renderHistory();
  if (mapInitialized && typeof createAllMarkers === 'function') {
    createAllMarkers();
    }
}
function deleteRecord(id) {
  if (!confirm('この記録を削除しますか？')) return;
  records = records.filter(r => r.id !== id);
  saveRecords(records);
  renderHistory();
}

// モーダル外タップで閉じる
document.getElementById('edit-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

async function bulkGeocode() {
  const targets = records.filter(r => !r.lat && r.address && r.address !== '住所未入力');
  if (!targets.length) { alert('座標が未設定の記録はありません'); return; }
  if (!confirm(`${targets.length}件の住所から地図ピンを作成します。少し時間がかかります。よろしいですか？`)) return;

  const btn = document.getElementById('bulk-geocode-btn');
  let done = 0, success = 0;

  for (const rec of targets) {
    btn.textContent = `処理中… (${done + 1}/${targets.length})`;
    const loc = await geocodeAddress(rec.address);
    if (loc) {
      rec.lat = loc.lat;
      rec.lng = loc.lng;
      success++;
      if (mapInitialized) addVisitMarker(rec);
    }
    done++;
    // API制限を避けるため少し待つ
    await new Promise(r => setTimeout(r, 200));
  }

  saveRecords(records);
  btn.textContent = '📍 住所から地図ピンを一括作成';
  alert(`完了しました。${success}/${targets.length}件のピンを作成しました。`);
  if (mapInitialized) applyMapFilters();
}


const RANK_BG = { 
  A: '#0000ff', // 青
  B: '#ffd700', // 黄色
  C: '#ff0000', // 赤
  D: '#808080', // グレー
  E: '#808080', // グレー
  F: '#000000'  // 黒
};

const RANK_TX = { 
  A: '#ffffff', // 白文字
  B: '#000000', // 黒文字（黄色背景で見やすくするため）
  C: '#ffffff', // 白文字
  D: '#ffffff', // 白文字
  E: '#ffffff', // 白文字
  F: '#ffffff'  // 白文字
};
const RESP_BG = { '不在':'rgba(107,114,128,0.12)','インターホン':'rgba(245,158,11,0.12)','対面':'rgba(30,142,62,0.12)' };
const RESP_TX = { '不在':'#546e7a','インターホン':'#e65100','対面':'#1b5e20' };

let regionGroupMode = false;
function toggleRegionGroup() {
  regionGroupMode = !regionGroupMode;
  const btn = document.getElementById('region-toggle');
  btn.textContent = regionGroupMode ? '📋 通常表示に戻す' : '🗂 地域別にまとめる';
  btn.style.background = regionGroupMode ? 'var(--accent-light)' : 'var(--bg2)';
  btn.style.color = regionGroupMode ? 'var(--accent)' : 'var(--text2)';
  renderHistory();
}

// 住所から地域名を抽出（都道府県+市区町村+町名、丁目の手前まで）
function extractRegion(address) {
  if (!address) return 'その他';
  // 「〇丁目」の手前までを地域名として扱う
  let base = address.split(/\d+丁目/)[0];
  const m = base.match(/^(.{2,4}[都道府県])?(.{1,8}?[市区町村郡])(.{1,10}?(町|大字|字))?/);
  if (m) {
    return (m[1] || '') + (m[2] || '') + (m[3] || '');
  }
  return base.slice(0, 8) || 'その他';
}

function formatDate(v) {
  if (v.date && v.date.includes(':')) return v.date; // すでに時刻入りならそのまま表示
  if (v.timestamp) {
    const d = new Date(v.timestamp);
    if (!isNaN(d.getTime())) {
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return v.date || ''; // 時間が入っていない過去データはそのままの日付を返す
}

// タイムスタンプや日付文字列を「月/日 時:分」の形式に変換する関数
function formatDate(v) {
  if (!v) return '';
  // 既に「9/22 14:30」のように時刻が含まれている場合はそのまま表示
  if (v.date && v.date.includes(':')) return v.date;
  
  // timestamp（ミリ秒）が存在する場合は Date オブジェクトに変換して日時を整形
  if (v.timestamp) {
    const d = new Date(v.timestamp);
    if (!isNaN(d.getTime())) {
      const month = d.getMonth() + 1;
      const date = d.getDate();
      const hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${month}/${date} ${hours}:${minutes}`;
    }
  }
  
  // フォールバック（従来の日付表示）
  return v.date || '';
}

function renderHistory() {
  const q = (document.getElementById('search-inp')?.value || '').toLowerCase();
  const rf = document.getElementById('rank-filter')?.value || '';
  const grouped = {};

  if (Array.isArray(records)) {
    records.forEach(r => {
      if (!r) return;
      const key = (r.name || '') + '__' + (r.address || '');
      if (!grouped[key]) grouped[key] = { name: r.name || '', address: r.address || '', visits: [] };
      grouped[key].visits.push(r);
    });
  }
  let persons = Object.values(grouped);

  // --- ★ カウント機能（ランクごとの件数と総件数を集計） ---
  const counts = { total: persons.length, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  persons.forEach(p => {
    if (p.visits && p.visits.length > 0) {
      const r = p.visits[0].rank;
      if (counts[r] !== undefined) counts[r]++;
    }
  });

  const totalVisitsCount = Array.isArray(records) ? records.length : 0;

  // カウントバーのHTML
  const countBarHtml = `
    <div style="margin-bottom:16px; padding:12px; background:var(--bg2, #f8f9fa); border-radius:var(--radius-md, 8px); border:0.5px solid var(--border, #e0e0e0);">
      <div style="font-size:12px; font-weight:600; color:var(--text2, #666); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>📊 ランク別件数 (全 ${counts.total} 軒)</span>
        <span style="font-size:12px; font-weight:700; color:var(--accent, #1a73e8);">🏆 延べ訪問: ${totalVisitsCount} 回</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:4px; text-align:center;">
        ${['A','B','C','D','E','F'].map(r => {
          const bg = (typeof RANK_BG !== 'undefined' && RANK_BG[r]) ? RANK_BG[r] : '#eee';
          const tx = (typeof RANK_TX !== 'undefined' && RANK_TX[r]) ? RANK_TX[r] : '#333';
          return `
            <div style="background:${bg}; color:${tx}; padding:6px 2px; border-radius:6px; font-size:11px; font-weight:bold; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
              <div>${r}</div>
              <div style="font-size:13px; margin-top:2px;">${counts[r]}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 検索・ランクフィルターの適用
  if (q) persons = persons.filter(p => (p.name || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q));
  if (rf) persons = persons.filter(p => p.visits[0] && p.visits[0].rank === rf);

  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  // 下部固定操作ボタン群
  const footerButtonsHtml = `
    <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:0.5px solid var(--border);">
      <button onclick="importExcel()" style="flex:1;padding:11px;background:var(--success-light, #e6f4ea);border:0.5px solid rgba(30,142,62,0.25);border-radius:var(--radius-sm, 4px);color:var(--success, #1e8e3e);font-size:13px;font-weight:500;cursor:pointer;">📥 Excelから読み込む</button>
      <button onclick="exportExcel()" style="flex:1;padding:11px;background:var(--accent-light, #e8f0fe);border:0.5px solid rgba(26,115,232,0.25);border-radius:var(--radius-sm, 4px);color:var(--accent, #1a73e8);font-size:13px;font-weight:500;cursor:pointer;">📤 Excelへ出力</button>
    </div>
    <button onclick="bulkGeocode()" id="bulk-geocode-btn" style="width:100%;margin-top:8px;padding:11px;background:var(--warning-light, #fef7e0);border:0.5px solid rgba(245,158,11,0.3);border-radius:var(--radius-sm, 4px);color:var(--warning, #b06000);font-size:13px;font-weight:500;cursor:pointer;">📍 住所から地図ピンを一括作成</button>
    <button onclick="clearAllData()" style="width:100%;margin-top:12px;padding:11px;background:rgba(221,44,0,0.1);border:0.5px solid rgba(221,44,0,0.3);border-radius:var(--radius-sm, 4px);color:#dd2c00;font-size:13px;font-weight:600;cursor:pointer;">
      🗑 全データを一括削除
    </button>
  `;

  if (!list) return;

  if (!persons.length) { 
    list.innerHTML = countBarHtml + footerButtonsHtml; 
    if (empty) empty.style.display = 'block'; 
    return; 
  }
  if (empty) empty.style.display = 'none';

  // 日時表示用の安全なフォーマット処理（インライン）
  const getDisplayDate = (v) => {
    if (!v) return '';
    if (v.timestamp) {
      const d = new Date(v.timestamp);
      if (!isNaN(d.getTime())) {
        const m = d.getMonth() + 1;
        const date = d.getDate();
        const h = d.getHours();
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${m}/${date} ${h}:${min}`;
      }
    }
    return v.date || '';
  };

  const renderPersonCard = p => {
    const last = p.visits[0] || {};
    const rankBg = (typeof RANK_BG !== 'undefined' && RANK_BG[last.rank]) ? RANK_BG[last.rank] : '#808080';
    const rankTx = (typeof RANK_TX !== 'undefined' && RANK_TX[last.rank]) ? RANK_TX[last.rank] : '#fff';

    const rows = p.visits.map(v => {
      const safeMemo = typeof escHtml === 'function' ? escHtml(v.memo || '') : (v.memo || '');
      const respBg = (typeof RESP_BG !== 'undefined' && RESP_BG[v.response]) ? RESP_BG[v.response] : 'rgba(107,114,128,0.12)';
      const respTx = (typeof RESP_TX !== 'undefined' && RESP_TX[v.response]) ? RESP_TX[v.response] : '#546e7a';
      const displayDate = getDisplayDate(v);

      return `
        <div class="visit-row">
          <span class="visit-date">${displayDate}</span>
          <span class="resp-badge" style="background:${respBg};color:${respTx}">${v.response || ''}</span>
          <span class="visit-memo">${safeMemo}</span>
          <div class="visit-actions">
            <button class="btn-edit" onclick="openEdit(${v.id})">編集</button>
            <button class="btn-delete" onclick="deleteRecord(${v.id})">削除</button>
          </div>
        </div>`;
    }).join('');

    const safeName = typeof escHtml === 'function' ? escHtml(p.name) : p.name;
    const safeAddr = typeof escHtml === 'function' ? escHtml(p.address) : p.address;

    return `<div class="person-card">
      <div class="person-head">
        <div>
          <p class="person-name">${safeName}</p>
          <p class="person-addr">${safeAddr}</p>
        </div>
        <div class="person-right">
          <span class="rank-badge" style="background:${rankBg};color:${rankTx}">ランク ${last.rank || '-'}</span>
          <span class="visit-count">計 ${p.visits.length} 回</span>
        </div>
      </div>
      <div class="visit-log">${rows}</div>
    </div>`;
  };

  let mainContentHtml = '';

  if (typeof regionGroupMode === 'undefined' || !regionGroupMode) {
    mainContentHtml = persons.map(renderPersonCard).join('');
  } else {
    const regions = {};
    persons.forEach(p => {
      const region = typeof extractRegion === 'function' ? extractRegion(p.address) : 'その他';
      if (!regions[region]) regions[region] = [];
      regions[region].push(p);
    });
    const sortedRegions = Object.keys(regions).sort((a,b) => regions[b].length - regions[a].length);

    mainContentHtml = sortedRegions.map(region => {
      const safeRegion = typeof escHtml === 'function' ? escHtml(region) : region;
      return `
        <div style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;">
            <span style="font-size:13px;font-weight:600;color:var(--text);">${safeRegion}</span>
            <span style="font-size:11px;color:var(--text3);background:var(--bg3);padding:1px 8px;border-radius:10px;">${regions[region].length}件</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${regions[region].map(renderPersonCard).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  list.innerHTML = countBarHtml + mainContentHtml + footerButtonsHtml;
}

// ── Google Maps + 足跡（5m間隔・高精度） ──
let map = null, mapInitialized = false;
let trailPolyline = null, trackingActive = false, watchId = null, currentMarker = null;
let lastTrailPoint = null;
let visitMarkers = [];
let pinsVisible = true;

// ── ピン非表示 / 表示 切り替えボタン ──
function togglePins() {
  if (typeof window.pinsVisible === 'undefined') {
    window.pinsVisible = true;
  }
  
  window.pinsVisible = !window.pinsVisible;

  // ボタンの文字変更（HTMLの id="pins-label" に対応）
  const label = document.getElementById('pins-label');
  const btn = document.getElementById('pins-btn');
  
  if (label) {
    label.textContent = window.pinsVisible ? 'ピン表示' : 'ピン非表示';
  }
  
  // ボタンの見た目（activeクラス）の切り替え
  if (btn) {
    if (window.pinsVisible) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }

  // 地図上のマーカーをすべて表示・非表示切り替え
  if (typeof visitMarkers !== 'undefined' && Array.isArray(visitMarkers)) {
    visitMarkers.forEach(m => {
      if (m) m.setVisible(window.pinsVisible);
    });
  }
}


// ── 地図の初期化・APIスクリプトの動的読み込み ──
function initMap() {
  if (mapInitialized) return;

  // すでに script タグが存在していれば二重追加しない
  if (document.getElementById('google-maps-sdk')) return;

  const script = document.createElement('script');
  script.id = 'google-maps-sdk';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=onMapReady&loading=async&libraries=places`;
  script.async = true;
  document.head.appendChild(script);
}

window.onMapReady = function() {
  mapInitialized = true;
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 35.6812, lng: 139.7671 },
    zoom: 16,
    disableDefaultUI: true,
    zoomControl: true,
  });

  trailPolyline = new google.maps.Polyline({
    path: trail,
    strokeColor: '#1a73e8',
    strokeOpacity: 0.85,
    strokeWeight: 4,
    map: map,
    icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: '#1a73e8' }, offset: '100%', repeat: '80px' }]
  });

  // 全データからマーカー作成
  records.forEach(r => { if (r.lat && r.lng) addVisitMarker(r); });

  // ★ここを追加！マーカー作成後にフィルター（フォルダ・ランク判定）を適用する
  applyMapFilters();

  goToCurrentPos();
};
// 2点間の距離をメートルで計算（Haversine）
function calcDistance(p1, p2) {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat*Math.PI/180) * Math.cos(p2.lat*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── 地図上のランクフィルター処理（完全防衛版） ──
let mapRankFilter = '';

function setupMapRankFilter() {
  const filterBar = document.getElementById('map-rank-filter');
  if (!filterBar) return;

  const chips = filterBar.querySelectorAll('.map-rank-chip');
  chips.forEach(chip => {
    // 重複登録を防ぐため、一度削除してから登録
    chip.removeEventListener('click', handleChipClick);
    chip.addEventListener('click', handleChipClick);
  });
}

function handleChipClick(e) {
  const filterBar = document.getElementById('map-rank-filter');
  if (filterBar) {
    filterBar.querySelectorAll('.map-rank-chip').forEach(c => c.classList.remove('active'));
  }
  
  const chip = e.currentTarget;
  chip.classList.add('active');

  // data-rank の値を大文字に統一してセット
  mapRankFilter = (chip.dataset.rank || '').trim().toUpperCase();
  console.log('選択されたランク:', mapRankFilter); // デバッグ用ログ

  // 即座にフィルター適用
  applyMapFilters();
}

// ページ読み込み時・読み込み完了後の両方で安全に初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMapRankFilter);
} else {
  setupMapRankFilter();
}


// ── フィルター適用関数 ──
function applyMapFilters() {
  if (!map || !Array.isArray(visitMarkers)) return;

  visitMarkers.forEach(m => {
    // ピン側のランクも大文字に統一
    const markerRank = String(m._rank || '').trim().toUpperCase();

    // ランク未選択（全て）または ランクが完全一致
    const matchRank = !mapRankFilter || markerRank === mapRankFilter;

    // ピンを表示するかどうか判定
    const show = matchRank;

    if (m && typeof m.setMap === 'function') {
      m.setMap(show ? map : null);
    }
  });
}

// ── 日付パース用の安全な関数 ──
function parseLogTime(r) {
  if (r.timestamp && typeof r.timestamp === 'number') return r.timestamp;
  if (!r.date) return 0;
  const parts = String(r.date).split(/[\/\-\s]/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  const currentYear = new Date().getFullYear();
  
  if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  if (parts.length === 2) return new Date(currentYear, parts[0] - 1, parts[1]).getTime(); // 動的に本年の年を取得
  const d = new Date(r.date);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

// ── 同一人物の全データランク同期（履歴を壊さないよう同期処理は停止、またはそのまま保持） ──
function syncPersonRank(name, address, newRank) {
  // 履歴の整合性を保つため、過去ログのrank直接書き換えは行わず、
  // 最新ログのrankを参照させる仕組みにします
}

// ── 履歴一覧の描画（完全修正版） ──
function renderHistory() {
  const q = (document.getElementById('search-inp')?.value || '').toLowerCase();
  const rf = document.getElementById('rank-filter')?.value || '';
  const grouped = {};

  if (Array.isArray(records)) {
    records.forEach(r => {
      if (!r) return;
      const key = (r.name || '') + '__' + (r.address || '');
      if (!grouped[key]) grouped[key] = { name: r.name || '', address: r.address || '', visits: [] };
      grouped[key].visits.push(r);
    });
  }
  let persons = Object.values(grouped);

  // ★ 1. 各人物の訪問記録を「最新順（新しい順）」にソート！
  persons.forEach(p => {
    p.visits.sort((a, b) => parseLogTime(b) - parseLogTime(a));
  });

  // --- ★ 2. 集計（常に最新の訪問ログ visits[0] のランクを採用） ---
  const counts = { total: persons.length, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  persons.forEach(p => {
    if (p.visits && p.visits.length > 0) {
      const latestRank = p.visits[0].rank; // 必ず最新のランクを参照
      if (counts[latestRank] !== undefined) counts[latestRank]++;
    }
  });

  const totalVisitsCount = Array.isArray(records) ? records.length : 0;

  // カウントバーのHTML
  const countBarHtml = `
    <div style="margin-bottom:16px; padding:12px; background:var(--bg2, #f8f9fa); border-radius:var(--radius-md, 8px); border:0.5px solid var(--border, #e0e0e0);">
      <div style="font-size:12px; font-weight:600; color:var(--text2, #666); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
        <span>📊 ランク別件数 (全 ${counts.total} 軒)</span>
        <span style="font-size:12px; font-weight:700; color:var(--accent, #1a73e8);">🏆 延べ訪問: ${totalVisitsCount} 回</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(6, 1fr); gap:4px; text-align:center;">
        ${['A','B','C','D','E','F'].map(r => {
          const bg = (typeof RANK_BG !== 'undefined' && RANK_BG[r]) ? RANK_BG[r] : '#eee';
          const tx = (typeof RANK_TX !== 'undefined' && RANK_TX[r]) ? RANK_TX[r] : '#333';
          return `
            <div style="background:${bg}; color:${tx}; padding:6px 2px; border-radius:6px; font-size:11px; font-weight:bold; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
              <div>${r}</div>
              <div style="font-size:13px; margin-top:2px;">${counts[r]}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 検索・ランクフィルターの適用（最新ログのランクで絞り込み）
  if (q) persons = persons.filter(p => (p.name || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q));
  if (rf) persons = persons.filter(p => p.visits[0] && p.visits[0].rank === rf);

  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  // 下部固定操作ボタン群
  const footerButtonsHtml = `
    <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:0.5px solid var(--border);">
      <button onclick="importExcel()" style="flex:1;padding:11px;background:var(--success-light, #e6f4ea);border:0.5px solid rgba(30,142,62,0.25);border-radius:var(--radius-sm, 4px);color:var(--success, #1e8e3e);font-size:13px;font-weight:500;cursor:pointer;">📥 Excelから読み込む</button>
      <button onclick="exportExcel()" style="flex:1;padding:11px;background:var(--accent-light, #e8f0fe);border:0.5px solid rgba(26,115,232,0.25);border-radius:var(--radius-sm, 4px);color:var(--accent, #1a73e8);font-size:13px;font-weight:500;cursor:pointer;">📤 Excelへ出力</button>
    </div>
    <button onclick="bulkGeocode()" id="bulk-geocode-btn" style="width:100%;margin-top:8px;padding:11px;background:var(--warning-light, #fef7e0);border:0.5px solid rgba(245,158,11,0.3);border-radius:var(--radius-sm, 4px);color:var(--warning, #b06000);font-size:13px;font-weight:500;cursor:pointer;">📍 住所から地図ピンを一括作成</button>
    <button onclick="clearAllData()" style="width:100%;margin-top:12px;padding:11px;background:rgba(221,44,0,0.1);border:0.5px solid rgba(221,44,0,0.3);border-radius:var(--radius-sm, 4px);color:#dd2c00;font-size:13px;font-weight:600;cursor:pointer;">
      🗑 全データを一括削除
    </button>
  `;

  if (!list) return;

  if (!persons.length) { 
    list.innerHTML = countBarHtml + footerButtonsHtml; 
    if (empty) empty.style.display = 'block'; 
    return; 
  }
  if (empty) empty.style.display = 'none';

  const getDisplayDate = (v) => {
    if (!v) return '';
    const t = parseLogTime(v);
    if (t > 0) {
      const d = new Date(t);
      const m = d.getMonth() + 1;
      const date = d.getDate();
      const h = d.getHours();
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${m}/${date} ${h}:${min}`;
    }
    return v.date || '';
  };

  const renderPersonCard = p => {
    const last = p.visits[0] || {}; // ソート済みなので0番目が確実に最新！
    const rankBg = (typeof RANK_BG !== 'undefined' && RANK_BG[last.rank]) ? RANK_BG[last.rank] : '#808080';
    const rankTx = (typeof RANK_TX !== 'undefined' && RANK_TX[last.rank]) ? RANK_TX[last.rank] : '#fff';

    const rows = p.visits.map(v => {
      const safeMemo = typeof escHtml === 'function' ? escHtml(v.memo || '') : (v.memo || '');
      const respBg = (typeof RESP_BG !== 'undefined' && RESP_BG[v.response]) ? RESP_BG[v.response] : 'rgba(107,114,128,0.12)';
      const respTx = (typeof RESP_TX !== 'undefined' && RESP_TX[v.response]) ? RESP_TX[v.response] : '#546e7a';
      const displayDate = getDisplayDate(v);

      return `
        <div class="visit-row">
          <span class="visit-date">${displayDate}</span>
          <span class="resp-badge" style="background:${respBg};color:${respTx}">${v.response || ''}</span>
          <span class="visit-memo">${safeMemo}</span>
          <div class="visit-actions">
            <button class="btn-edit" onclick="openEdit(${v.id})">編集</button>
            <button class="btn-delete" onclick="deleteRecord(${v.id})">削除</button>
          </div>
        </div>`;
    }).join('');

    const safeName = typeof escHtml === 'function' ? escHtml(p.name) : p.name;
    const safeAddr = typeof escHtml === 'function' ? escHtml(p.address) : p.address;

    return `<div class="person-card">
      <div class="person-head">
        <div>
          <p class="person-name">${safeName}</p>
          <p class="person-addr">${safeAddr}</p>
        </div>
        <div class="person-right">
          <span class="rank-badge" style="background:${rankBg};color:${rankTx}">ランク ${last.rank || '-'}</span>
          <span class="visit-count">計 ${p.visits.length} 回</span>
        </div>
      </div>
      <div class="visit-log">${rows}</div>
    </div>`;
  };

  let mainContentHtml = '';

  if (typeof regionGroupMode === 'undefined' || !regionGroupMode) {
    mainContentHtml = persons.map(renderPersonCard).join('');
  } else {
    const regions = {};
    persons.forEach(p => {
      const region = typeof extractRegion === 'function' ? extractRegion(p.address) : 'その他';
      if (!regions[region]) regions[region] = [];
      regions[region].push(p);
    });
    const sortedRegions = Object.keys(regions).sort((a,b) => regions[b].length - regions[a].length);

    mainContentHtml = sortedRegions.map(region => {
      const safeRegion = typeof escHtml === 'function' ? escHtml(region) : region;
      return `
        <div style="margin-bottom:4px;">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 4px;">
            <span style="font-size:13px;font-weight:600;color:var(--text);">${safeRegion}</span>
            <span style="font-size:11px;color:var(--text3);background:var(--bg3);padding:1px 8px;border-radius:10px;">${regions[region].length}件</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${regions[region].map(renderPersonCard).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  list.innerHTML = countBarHtml + mainContentHtml + footerButtonsHtml;
}

function createFolder() {
  const query = document.getElementById('folder-search').value.trim();
  const name = document.getElementById('folder-name-input').value.trim();
  if (!query) { alert('検索条件を入力してください'); return; }
  if (!name) { alert('フォルダ名を入力してください'); return; }

  const q = norm(query);
  const persons = getPersonsList().filter(p => norm(p.address).includes(q) || norm(p.name).includes(q));
  if (!persons.length) { alert('該当する記録がありません'); return; }

  folders.unshift({
    id: Date.now(),
    name,
    query,
    personKeys: persons.map(p => p.key),
    createdAt: Date.now(),
  });
  saveFolders(folders);

  document.getElementById('folder-search').value = '';
  document.getElementById('folder-name-input').value = '';
  document.getElementById('folder-preview-list').innerHTML = '';
  document.getElementById('folder-preview-count').textContent = '';

  renderFolderList();
  alert(`フォルダ「${name}」を作成しました（${persons.length}件）`);
}

// 地域名（丁目手前まで）ごとに自動でフォルダを作成
function autoCreateFoldersByRegion() {
  const persons = getPersonsList().filter(p => p.address && p.address !== '住所未入力');
  if (!persons.length) { alert('住所が登録された記録がありません'); return; }

  const regionMap = {};
  persons.forEach(p => {
    const region = extractRegion(p.address);
    if (!regionMap[region]) regionMap[region] = [];
    regionMap[region].push(p.key);
  });

  const regionNames = Object.keys(regionMap).filter(r => r !== 'その他');
  if (!regionNames.length) { alert('地域を判定できる住所が見つかりませんでした'); return; }

  if (!confirm(`${regionNames.length}件の地域フォルダを自動作成します。\n既存の同名フォルダは上書きされます。よろしいですか？`)) return;

  let created = 0;
  regionNames.forEach(region => {
    const personKeys = regionMap[region];
    if (personKeys.length < 1) return;
    // 同名フォルダがあれば置き換え
    const existingIdx = folders.findIndex(f => f.name === region && f.autoGenerated);
    const folderData = {
      id: existingIdx >= 0 ? folders[existingIdx].id : Date.now() + created,
      name: region,
      query: region,
      personKeys,
      createdAt: Date.now(),
      autoGenerated: true,
    };
    if (existingIdx >= 0) {
      folders[existingIdx] = folderData;
    } else {
      folders.unshift(folderData);
    }
    created++;
  });

  saveFolders(folders);
  renderFolderList();
  alert(`${created}件の地域フォルダを作成しました`);
}

function renderFolderList() {
  document.getElementById('folder-detail').style.display = 'none';
  const list = document.getElementById('folder-list');
  const empty = document.getElementById('folder-empty');
  if (!folders.length) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  // 自動生成フォルダを先にまとめて表示、手動フォルダを後に
  const autoFolders = folders.filter(f => f.autoGenerated).sort((a,b) => a.name.localeCompare(b.name, 'ja'));
  const manualFolders = folders.filter(f => !f.autoGenerated);
  const sorted = [...manualFolders, ...autoFolders];

  list.innerHTML = sorted.map(f => `
    <div class="folder-card" onclick="openFolder(${f.id})">
      <div class="folder-card-left">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22" style="color:${f.autoGenerated ? 'var(--success)' : 'var(--accent)'};flex-shrink:0;"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        <div>
          <p class="folder-card-name">${escHtml(f.name)}${f.autoGenerated ? ' <span style="font-size:10px;background:var(--success-light);color:var(--success);padding:1px 6px;border-radius:4px;font-weight:500;">自動</span>' : ''}</p>
          <p class="folder-card-count">${f.personKeys.length}件</p>
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="color:var(--text3);"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  `).join('');
}

let currentFolderId = null;
function openFolder(id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  currentFolderId = id;
  document.getElementById('folder-detail-title').textContent = folder.name;
  document.getElementById('folder-detail').style.display = 'block';

  const allPersons = getPersonsList();
  const persons = allPersons.filter(p => folder.personKeys.includes(p.key));

  const detailList = document.getElementById('folder-detail-list');
  if (!persons.length) {
    detailList.innerHTML = '<p class="empty-msg">該当する記録がありません</p>';
    return;
  }
  detailList.innerHTML = persons.map(p => {
    const last = p.visits[0];
    const rows = p.visits.map(v => `
      <div class="visit-row">
        <span class="visit-date">${v.date}</span>
        <span class="resp-badge" style="background:${RESP_BG[v.response]||'rgba(107,114,128,0.12)'};color:${RESP_TX[v.response]||'#546e7a'}">${v.response}</span>
        <span class="visit-memo">${escHtml(v.memo || '')}</span>
        <div class="visit-actions">
          <button class="btn-edit" onclick="openEdit(${v.id})">編集</button>
          <button class="btn-delete" onclick="deleteRecord(${v.id})">削除</button>
        </div>
      </div>`).join('');
    return `<div class="person-card">
      <div class="person-head">
        <div>
          <p class="person-name">${escHtml(p.name)}</p>
          <p class="person-addr">${escHtml(p.address)}</p>
        </div>
        <div class="person-right">
          <span class="rank-badge" style="background:${RANK_BG[last.rank]};color:${RANK_TX[last.rank]}">ランク ${last.rank}</span>
          <span class="visit-count">計 ${p.visits.length} 回</span>
        </div>
      </div>
      <div class="visit-log">${rows}</div>
    </div>`;
  }).join('');
}

function closeFolderDetail() {
  currentFolderId = null;
  document.getElementById('folder-detail').style.display = 'none';
}

function deleteFolder() {
  if (currentFolderId === null) return;
  const folder = folders.find(f => f.id === currentFolderId);
  if (!folder) return;
  if (!confirm(`フォルダ「${folder.name}」を削除しますか？（中の記録は削除されません）`)) return;
  folders = folders.filter(f => f.id !== currentFolderId);
  saveFolders(folders);
  closeFolderDetail();
  renderFolderList();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
// ==========================================
// 全データの一括削除処理
// ==========================================
function clearAllData() {
  // 1段階目の確認
  const confirm1 = confirm("【警告】保存されているすべての営業ログ・訪問履歴・フォルダ設定を削除しますか？\n（この操作は取り消せません）");
  if (!confirm1) return;

  // 2段階目の確認（バックアップの確認）
  const confirm2 = confirm("削除する前にExcel等へバックアップは出力しましたか？\n本当にすべてのデータを初期化してよろしいですか？");
  if (!confirm2) return;

  // 1. メモリ上のデータを空にする（★これが大事！）
  if (typeof records !== 'undefined') records = [];
  if (typeof folders !== 'undefined') folders = [];

  // 2. LocalStorageのデータを削除（念のためキー個別に加えて clear() も実行すると確実に消えるよ！）
  localStorage.removeItem("sales_records");
  localStorage.removeItem("sales_folders");
  localStorage.removeItem("sales_counter");
  localStorage.removeItem("sales_trail");
  localStorage.clear(); // 関連データをまるごと初期化！

  alert("すべてのデータを初期化しました。");

  // 3. リロードせずにそのまま画面を再描画する
  if (typeof renderHistory === 'function') {
    renderHistory();
  } else {
    location.reload();
  }
}
function addVisitMarker(rec) {
  if (!rec || !rec.lat || !rec.lng) return null;

  const activeMap = map || window.map;
  if (!activeMap) {
    console.warn("地図(map)がまだ準備できていません:", rec);
    return null;
  }

  // ★ 1. 重複防止チェック（すでに同じIDのピンが地図上にあれば削除）
  if (typeof visitMarkers !== 'undefined' && Array.isArray(visitMarkers)) {
    const existingIndex = visitMarkers.findIndex(m => m._recordId === rec.id);
    if (existingIndex !== -1) {
      visitMarkers[existingIndex].setMap(null); // 地図上から削除
      visitMarkers.splice(existingIndex, 1);    // 配列から除去
    }
  }

  // ランクごとの色を取得
  const rank = rec.rank || 'F';
  const bgColor = (typeof RANK_BG !== 'undefined' && RANK_BG[rank]) ? RANK_BG[rank] : '#808080';
  const txColor = (typeof RANK_TX !== 'undefined' && RANK_TX[rank]) ? RANK_TX[rank] : '#ffffff';

  const marker = new google.maps.Marker({
    position: { lat: Number(rec.lat), lng: Number(rec.lng) },
    map: activeMap,
    title: rec.name || rec.address || '',
    visible: typeof window.pinsVisible !== 'undefined' ? window.pinsVisible : true,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: bgColor,
      fillOpacity: 0.95,
      scale: 8, // ★ 12から8に小さく変更！
      strokeColor: '#FFFFFF',
      strokeWeight: 1.5,
    },
    label: {
      text: String(rank),
      color: txColor,
      fontSize: '9px', // ★ 11pxから9pxに小さく変更！
      fontWeight: 'bold'
    }
  });

  // フィルター用にランク情報を持たせる
  marker._rank = rank;
  // ★ 2. 重複チェック用にレコードIDを持たせる
  marker._recordId = rec.id;

  // ★ 吹き出し（InfoWindow）の作成とクリック処理
  const contentString = `
    <div style="padding:6px; max-width:200px; font-family:sans-serif; color:#333;">
      <div style="font-weight:bold; font-size:14px; margin-bottom:4px;">
        ${rec.name || '名前未入力'}
      </div>
      <div style="font-size:12px; color:#666; margin-bottom:4px;">
        📍 ${rec.address || '住所未入力'}
      </div>
      <div style="font-size:12px; margin-bottom:4px;">
        <span style="background:${bgColor}; color:${txColor}; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">
          ランク: ${rank}
        </span>
        <span style="margin-left:6px; color:#555; font-weight:500;">
          ${rec.response || ''}
        </span>
      </div>
      ${rec.memo ? `<div style="font-size:11px; color:#777; border-top:1px solid #eee; padding-top:4px; margin-top:4px;">${rec.memo}</div>` : ''}
    </div>
  `;

  const infoWindow = new google.maps.InfoWindow({
    content: contentString
  });

  // ピンをクリック（タップ）したときに吹き出しを開く
  marker.addListener('click', () => {
    if (window.currentInfoWindow) {
      window.currentInfoWindow.close();
    }
    infoWindow.open(activeMap, marker);
    window.currentInfoWindow = infoWindow;
  });

  if (typeof visitMarkers !== 'undefined') {
    visitMarkers.push(marker);
  }

  return marker;
}

// ── 現在地に移動 ──
function goToCurrentPos() {
  if (!navigator.geolocation) {
    alert("お使いのブラウザは位置情報に対応していません");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const latLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (map) {
        map.setCenter(latLng);
        map.setZoom(17);
        updateCurrentMarker(latLng);
      }
    },
    (err) => {
      console.error("現在地取得エラー:", err);
      alert("現在地を取得できませんでした");
    },
    { enableHighAccuracy: true }
  );
}

// 現在地マーカーの更新/描画
function updateCurrentMarker(latLng) {
  if (!map) return;
  if (!currentMarker) {
    // 現在地を示す青い丸アイコン
    currentMarker = new google.maps.Marker({
      position: latLng,
      map: map,
      title: "現在地",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#4285F4",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      }
    });
  } else {
    currentMarker.setPosition(latLng);
  }
}

// ── 追跡開始 / 停止の切り替え ──
function toggleTracking() {
  trackingActive = !trackingActive;
  const btn = document.getElementById('tracking-btn') || document.getElementById('track-btn');

  if (trackingActive) {
    if (btn) btn.textContent = '⏹ 追跡停止';
    startTracking();
  } else {
    if (btn) btn.textContent = '▶ 追跡開始';
    stopTracking();
  }
}

function startTracking() {
  if (!navigator.geolocation) return;

  // 足跡描画用の Polyline がなければ作成
  if (!trailPolyline && map) {
    trailPolyline = new google.maps.Polyline({
      map: map,
      strokeColor: '#FF0000',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      path: []
    });
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const newPt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      updateCurrentMarker(newPt);

      // 前回の地点から一定距離（例: 5m）以上離れていたら足跡を伸ばす
      if (!lastTrailPoint || getDistance(lastTrailPoint, newPt) >= 5) {
        if (trailPolyline) {
          const path = trailPolyline.getPath();
          path.push(new google.maps.LatLng(newPt.lat, newPt.lng));
        }
        lastTrailPoint = newPt;
      }
    },
    (err) => console.error("追跡エラー:", err),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ── 足跡をクリア ──
function clearTrail() {
  // 足跡が存在しないか、線が描かれていない場合はメッセージを出して終了
  if (!trailPolyline || trailPolyline.getPath().getLength() === 0) {
    alert("消去する足跡はありません");
    return;
  }

  // 確認ポップアップを表示（「キャンセル」を押したら処理を中断）
  const ok = confirm("これまでの足跡をクリアしますか？\n（この操作は取り消せません）");
  if (!ok) return;

  // 「OK」を押したら足跡の線を消去
  trailPolyline.setPath([]);
  lastTrailPoint = null;
  alert("足跡をクリアしました");
}

// 2点間の距離を計算するヘルパー関数（メートル単位）
function getDistance(p1, p2) {
  const R = 6371000; // 地球の半径 (m)
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Excel出力（エクスポート） ──
function exportExcel() {
  if (!records || records.length === 0) {
    alert('出力するデータがありません');
    return;
  }

  const exportData = records.map(r => ({
    '日付': r.date || '',
    '名前': r.name || '',
    '住所': r.address || '',
    '対応区分': r.response || '',
    '見込みランク': r.rank || '',
    '訪問種別': r.visit || '',
    'メモ': r.memo || '',
    '緯度': r.lat || '',
    '経度': r.lng || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '営業ログ');

  const now = new Date();
  const filename = `営業ログ_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

// ── Excel読み込み（インポート完全防衛版） ──
function importExcel() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.xlsx, .xls, .csv';

  fileInput.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonData || jsonData.length === 0) {
          alert('ファイル内にデータが見つかりませんでした');
          return;
        }

        let addedCount = 0;
        jsonData.forEach(row => {
          // カラム名の揺れ（表記違い）を強力に吸収する処理
          const name = row['名前'] || row['氏名'] || row['お客様名'] || row['顧客名'] || '名前未入力';
          const address = row['住所'] || row['所在地'] || '住所未入力';
          const rank = row['見込みランク'] || row['ランク'] || row['rank'] || 'E';
          const response = row['対応区分'] || row['対応'] || row['結果'] || '不在';
          const visit = row['訪問種別'] || row['種別'] || '初訪';
          const date = row['日付'] || row['日時'] || new Date().toLocaleDateString('ja-JP');
          const memo = row['メモ'] || row['備考'] || '';

          const rec = {
            id: Date.now() + Math.floor(Math.random() * 10000),
            date: String(date),
            timestamp: Date.now(),
            visit: String(visit),
            response: String(response),
            rank: String(rank).trim().toUpperCase(),
            name: String(name).trim(),
            address: String(address).trim(),
            memo: String(memo),
            lat: row['緯度'] ? Number(row['緯度']) : null,
            lng: row['経度'] ? Number(row['経度']) : null,
          };

          records.unshift(rec);
          addedCount++;
        });

        // データの保存（LocalStorageへ直接保存して確実に残す！）
        localStorage.setItem('sales_records', JSON.stringify(records));

        // 画面描画の更新
        if (typeof renderHistory === 'function') renderHistory();
        
        // 地図のピン更新
        if (typeof addVisitMarker === 'function') {
          records.forEach(r => { if (r.lat && r.lng) addVisitMarker(r); });
        }
        if (typeof applyMapFilters === 'function') applyMapFilters();

        alert(`${addedCount}件のデータを読み込みました！`);

      } catch (err) {
        console.error('Excel読み込みエラー:', err);
        alert('読み込み時にエラーが発生しました。ファイル形式を確認してください。');
      }
    };

    reader.readAsArrayBuffer(file);
  }; // ← ここで onchange を閉じる！

  fileInput.click();
} // ← ここで importExcel を閉じる！