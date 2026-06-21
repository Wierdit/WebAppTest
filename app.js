// ==================== SUPABASE CLIENT ====================
const SUPABASE_URL = 'https://axavmdnytvkjyjyytgsy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Rpb8DobkahQP6NBuWcoDaQ_BTp5eMH3';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== UI HELPERS ====================
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('section').forEach(s => observer.observe(s));

function scrollToSection(id) { document.getElementById(id).scrollIntoView({ behavior: 'smooth' }); }
function toggleMenu() { document.getElementById('main-nav').classList.toggle('open'); }

// ==================== AUTH ====================
let userEmail = '';

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('#main-nav a').forEach(l => {
        l.addEventListener('click', () => {
            document.getElementById('main-nav').classList.remove('open');
        });
    });

    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); requestOtp(); }
        });
    }

    const codeInput = document.getElementById('code');
    if (codeInput) {
        codeInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); confirmOtp(); }
        });
    }

    // Восстановление сессии
    const savedEmail = localStorage.getItem('userEmail');
    if (savedEmail) {
        userEmail = savedEmail;
        document.getElementById('auth-box').style.display = 'none';
        document.getElementById('user-dashboard').style.display = 'block';
        document.getElementById('user-greeting').innerText = `Здравствуйте, ${savedEmail}!`;
        updateDashboard();
        document.getElementById('login-nav').style.display = 'none';
    }
});

async function requestOtp() {
    const email = document.getElementById('email').value.trim();
    if (!email) {
        alert('Введите корректный e‑mail');
        return;
    }
    try {
        const { error } = await supabaseClient.auth.signInWithOtp({ email: email });
        if (error) throw error;
        userEmail = email;
        document.getElementById('step-1').style.display = 'none';
        document.getElementById('step-2').style.display = 'block';
        document.getElementById('code').focus();
        alert('Код отправлен на ваш e‑mail! Проверьте почту (и спам).');
    } catch (error) {
        console.error('Ошибка при отправке кода:', error);
        alert('Ошибка: ' + error.message);
    }
}

async function confirmOtp() {
    const code = document.getElementById('code').value.trim();
    if (!code) {
        alert('Введите код');
        return;
    }
    try {
        const { data, error } = await supabaseClient.auth.verifyOtp({
            email: userEmail,
            token: code,
            type: 'email'
        });
        if (error) throw error;
        localStorage.setItem('userEmail', userEmail);
        document.getElementById('auth-box').style.display = 'none';
        document.getElementById('user-dashboard').style.display = 'block';
        document.getElementById('user-greeting').innerText = `Здравствуйте, ${userEmail}!`;
        updateDashboard();
        document.getElementById('login-nav').style.display = 'none';
        alert('✅ Вход выполнен успешно!');
    } catch (error) {
        console.error('Ошибка подтверждения:', error);
        alert('Неверный код или ошибка: ' + error.message);
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    localStorage.clear();
    location.reload();
}

// ==================== DASHBOARD UPDATE ====================
function updateDashboard() {
    const points = parseInt(localStorage.getItem('userPoints') || 0);
    document.getElementById('user-points').innerText = `${points} баллов`;
    document.getElementById('total-points').innerText = points;

    // Счётчик чеков
    const checks = JSON.parse(localStorage.getItem('loadedChecks') || '[]');
    document.getElementById('receipt-count').innerText = checks.length;

    // История чеков (из отдельного хранилища)
    const history = JSON.parse(localStorage.getItem('receiptHistory') || '[]');
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    if (history.length === 0) {
        historyList.innerHTML = '<li style="text-align:center; color:#999;">Пока нет загруженных чеков</li>';
    } else {
        const recent = history.slice(-5).reverse();
        recent.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${item.date}</span><span class="points">+${item.points} баллов</span>`;
            historyList.appendChild(li);
        });
    }
}

function addPoints(amount) {
    let pts = parseInt(localStorage.getItem('userPoints') || 0);
    pts += amount;
    localStorage.setItem('userPoints', pts);
    const history = JSON.parse(localStorage.getItem('receiptHistory') || '[]');
    history.push({
        date: new Date().toLocaleString('ru-RU'),
        points: amount
    });
    localStorage.setItem('receiptHistory', JSON.stringify(history));
    updateDashboard();
}

// ==================== QR / FILE HANDLING (с подсветкой кнопок) ====================
function getUniqueCheckId(qrText) {
    try {
        const p = new URLSearchParams(qrText);
        const fn = p.get('fn') || '';
        const i = p.get('i') || '';
        const fp = p.get('fp') || '';
        if (fn && i && fp) return `${fn}_${i}_${fp}`;
        return qrText.substring(0, 100);
    } catch (e) { return qrText.substring(0, 100); }
}

function setButtonLoading(buttonId, loading) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    if (loading) {
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerHTML = '<span class="spinner"></span> Загрузка...';
    } else {
        btn.disabled = false;
        btn.classList.remove('loading');
        if (buttonId === 'scan-btn') btn.innerHTML = '📷 Сканировать QR‑код';
        else if (buttonId === 'upload-btn') btn.innerHTML = '🖼️ Загрузить фото';
        else if (buttonId === 'manual-btn') btn.innerHTML = '✍️ Ввести вручную';
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    setButtonLoading('upload-btn', true);
    const html5QrCode = new Html5Qrcode('reader');
    try {
        const decodedText = await html5QrCode.scanFile(file, true);
        const checkId = getUniqueCheckId(decodedText);
        const loaded = JSON.parse(localStorage.getItem('loadedChecks') || '[]');
        if (loaded.includes(checkId)) {
            alert('⚠️ Этот чек уже был загружен ранее! Баллы не начислены.');
            return;
        }
        loaded.push(checkId);
        localStorage.setItem('loadedChecks', JSON.stringify(loaded));
        alert(`✅ QR‑код распознан!\nТекст: ${decodedText}\n\n+10 баллов`);
        addPoints(10);
    } catch (err) {
        alert('❌ QR‑код не найден на изображении.');
    } finally {
        event.target.value = '';
        setButtonLoading('upload-btn', false);
    }
}

function manualInput() {
    const checkNum = prompt('Введите номер чека:');
    if (!checkNum) return;
    setButtonLoading('manual-btn', true);
    setTimeout(() => {
        const checkId = checkNum.trim();
        const loaded = JSON.parse(localStorage.getItem('loadedChecks') || '[]');
        if (loaded.includes(checkId)) {
            alert('⚠️ Этот чек уже был загружен ранее! Баллы не начислены.');
            setButtonLoading('manual-btn', false);
            return;
        }
        loaded.push(checkId);
        localStorage.setItem('loadedChecks', JSON.stringify(loaded));
        alert('✅ Чек найден! +10 баллов');
        addPoints(10);
        setButtonLoading('manual-btn', false);
    }, 1500);
}

function startScanner() {
    setButtonLoading('scan-btn', true);
    const html5QrCode = new Html5Qrcode('reader');
    html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decodedText => {
            const checkId = getUniqueCheckId(decodedText);
            const loaded = JSON.parse(localStorage.getItem('loadedChecks') || '[]');
            if (loaded.includes(checkId)) {
                alert('⚠️ Этот чек уже был загружен ранее! Баллы не начислены.');
                html5QrCode.stop();
                setButtonLoading('scan-btn', false);
                return;
            }
            loaded.push(checkId);
            localStorage.setItem('loadedChecks', JSON.stringify(loaded));
            alert(`✅ QR‑код считан!\nТекст: ${decodedText}\n\n+10 баллов`);
            addPoints(10);
            html5QrCode.stop();
            setButtonLoading('scan-btn', false);
        },
        errMsg => { /* игнорируем */ }
    ).catch(err => {
        alert('❌ Ошибка доступа к камере: ' + err);
        setButtonLoading('scan-btn', false);
    });
}

// ==================== INIT ====================
// При загрузке обновляем дашборд, если пользователь залогинен
// (это уже делается в DOMContentLoaded)
