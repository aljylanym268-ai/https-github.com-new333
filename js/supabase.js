// ========== قاعدة البيانات ==========
const SUPABASE_URL = 'https://wwojtkxwmgkrudtevbcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Rqi9qMZgIrslWSDc61gG-A_QGQxcvNr';
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== الحالة العامة ==========
const appState = {
    user: null,
    userData: {},
    location: null,
    products: [],
    currentProduct: null,
    services: [
        { id:1, name:"خدمات الصيانة", description:"صيانة منزلية، تصليح أجهزة كهربائية، سباكة", price:"150 ج.م", icon:"fas fa-tools" },
        { id:2, name:"خدمات التوصيل", description:"توصيل طلبات، نقل عفش، توصيل وثائق", price:"50 ج.م", icon:"fas fa-shipping-fast" },
        { id:3, name:"خدمات تعليمية", description:"دروس خصوصية، دورات تدريبية، استشارات تعليمية", price:"100 ج.م/ساعة", icon:"fas fa-graduation-cap" }
    ],
    villagesByCenter: {
        'قنا': ['قنا البلد','الشرق','الغرب','الكويت','الساحل'],
        'نقادة': ['نقادة','الركاب','الكلاحين','الزوايدة'],
        'قوص': ['قوص','العيايشة','الأشراف','المخادمة'],
        'دشنا': ['دشنا','أبو دياب','السمطا','العويضات'],
        'فرشوط': ['فرشوط','الكوم الأحمر','النجوع','الرواتب'],
        'أبو تشت': ['أبو تشت','البلابيش','النجوع','الرئيسية'],
        'نجع حمادي': ['نجع حمادي','الطود','الحلفاية','الغربية'],
        'قفط': ['قفط','القلعة','الرفش','الصباب']
    },
    seller: { products: [], orders: [], currentTab: 'products', filterCategory: 'all', filterOrderStatus: 'all', chart: null },
    delivery: { availableOrders: [], myOrders: [], currentTab: 'available' },
    tempImages: [],
    founderPageVisible: true,
    founderViews: 0,
    founderShares: { whatsapp:0, facebook:0, twitter:0, copy:0 },
    previousScreen: 'homeScreen',
    currentScreen: 'homeScreen',
    ordersSubscription: null,
    notificationsSubscription: null
};

// ========== دوال مساعدة ==========
function getBearElement() { return document.querySelector('.bear-avatar'); }
function setBearExpression(expression) {
    const bear = getBearElement();
    if (!bear) return;
    bear.classList.remove('sad', 'happy', 'covering-eyes', 'blink');
    if (expression === 'sad') bear.classList.add('sad');
    else if (expression === 'happy') bear.classList.add('happy');
    else if (expression === 'covering') bear.classList.add('covering-eyes');
    else if (expression === 'blink') { bear.classList.add('blink'); setTimeout(() => bear.classList.remove('blink'), 300); }
}
function showBearReaction(success) { setBearExpression(success ? 'happy' : 'sad'); setTimeout(() => setBearExpression(''), 1500); }
function showLoading(show = true) { document.getElementById('loadingOverlay').classList.toggle('active', show); }
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
function escapeHTML(str) { return String(str).replace(/[&<>"]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; if (m === '"') return '&quot;'; return m; }); }

// ========== ضغط الصور ==========
async function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) reject(new Error('فشل ضغط الصورة'));
                    else resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                }, file.type, quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ========== رفع صور المنتجات ==========
async function uploadProductImages(files) {
    if (!files || files.length === 0) return [];
    const urls = [];
    for (const file of files) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) throw new Error(`نوع الملف ${file.name} غير مدعوم`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`الملف ${file.name} كبير جداً (الحد 10 ميجابايت)`);
        const compressed = await compressImage(file, 1024, 1024, 0.8);
        const uniqueName = `product-${Date.now()}-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`;
        const filePath = `products/${uniqueName}`;
        const { error } = await supabaseClient.storage.from('product-images').upload(filePath, compressed, { cacheControl: '3600', upsert: false });
        if (error) throw new Error(`فشل رفع ${file.name}: ${error.message}`);
        const { data: { publicUrl } } = supabaseClient.storage.from('product-images').getPublicUrl(filePath);
        urls.push(publicUrl);
    }
    return urls;
}

// ========== المصادقة ==========
async function signInWithGoogle() {
    const accountType = document.getElementById('loginAccountType').value;
    sessionStorage.setItem('pendingAccountType', accountType);
    const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) showToast(error.message, 'error');
}
async function signInWithEmail() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return showToast('يرجى إدخال البريد وكلمة المرور', 'warning');
    showLoading(true);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    showLoading(false);
    if (error) { showToast(error.message, 'error'); showBearReaction(false); } else { showBearReaction(true); }
}
async function signUpWithEmail() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirmPassword').value;
    let accountType = document.getElementById('registerAccountType').value;
    let deliveryCenter = '';
    if (accountType === 'delivery') {
        deliveryCenter = document.getElementById('deliveryCenterSelect').value;
        if (!deliveryCenter) { showToast('يرجى اختيار المركز للمندوب', 'warning'); return; }
    }
    if (!email || !password || !confirm) return showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
    if (password !== confirm) return showToast('كلمة المرور غير متطابقة', 'error');
    if (password.length < 6) return showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
    if (email === 'sa3dgelany@gmail.com') { accountType = 'founder'; if (password !== '123456') { showToast('كلمة المرور الخاصة بحساب المؤسس غير صحيحة (يجب أن تكون 123456)', 'error'); return; } }
    const metadata = { account_type: accountType };
    if (name) metadata.full_name = name;
    if (accountType === 'delivery') { metadata.center = deliveryCenter; metadata.status = 'pending'; }
    showLoading(true);
    const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: metadata, emailRedirectTo: window.location.origin } });
    showLoading(false);
    if (error) { showToast(error.message, 'error'); showBearReaction(false); }
    else { showBearReaction(true); showToast('تم إنشاء الحساب بنجاح. يرجى تفعيل البريد الإلكتروني (إذا لزم الأمر)', 'success'); showScreen('loginScreen'); if (accountType === 'founder') setTimeout(() => initFounderSettings(), 2000); }
}
async function logout(showConfirm = true) {
    if (showConfirm && !confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    showLoading(true);
    const { error } = await supabaseClient.auth.signOut();
    showLoading(false);
    if (error) showToast(error.message, 'error');
    else { appState.user = null; appState.userData = {}; toggleLoginMenu(false); toggleSellerMenuItem(false); toggleDeliveryMenuItem(false); toggleFounderMenuItem(false); updateUserInfo(true); await loadCart(); await updateCartBadgeFromDB(); showScreen('homeScreen'); showToast('تم تسجيل الخروج', 'success'); }
}
async function switchAccount() { if (appState.user) await logout(false); showScreen('loginScreen'); }
function confirmLogout() { logout(true); }
function toggleLoginMenu(isLoggedIn) {
    const loginItem = document.getElementById('loginMenuItem');
    const logoutItem = document.getElementById('logoutMenuItem');
    if (loginItem && logoutItem) { loginItem.style.display = isLoggedIn ? 'none' : 'flex'; logoutItem.style.display = isLoggedIn ? 'flex' : 'none'; }
}
function toggleSellerMenuItem(isSeller) { const sellerItem = document.getElementById('sellerDashboardMenuItem'); if (sellerItem) sellerItem.style.display = isSeller ? 'flex' : 'none'; const sellerExtra = document.getElementById('sellerExtraFields'); if (sellerExtra) sellerExtra.style.display = isSeller ? 'block' : 'none'; }
function toggleDeliveryMenuItem(isDelivery) { const deliveryItem = document.getElementById('deliveryDashboardMenuItem'); if (deliveryItem) deliveryItem.style.display = isDelivery ? 'flex' : 'none'; }
function toggleFounderMenuItem(isFounder) { const founderItem = document.getElementById('founderDashboardMenuItem'); if (founderItem) founderItem.style.display = isFounder ? 'flex' : 'none'; }

// ========== تحميل بيانات المستخدم ==========
async function loadUserData() {
    if (!appState.user) return;
    const { data, error } = await supabaseClient.from('user_data').select('*').eq('id', appState.user.id).single();
    if (error && error.code !== 'PGRST116') { console.error(error); return; }
    if (data) { appState.userData = data; appState.location = { governorate: data.governorate || 'قنا', center: data.center || '', village: data.village || '' }; }
    else {
        const defaultData = { id: appState.user.id, name: appState.user.user_metadata?.full_name || appState.user.email?.split('@')[0] || '', phone: '', governorate: 'قنا', center: appState.user.user_metadata?.center || '', village: '', image_url: appState.user.user_metadata?.avatar_url || '', account_type: appState.user.user_metadata?.account_type || 'client', status: appState.user.user_metadata?.status || 'approved' };
        await supabaseClient.from('user_data').upsert(defaultData);
        appState.userData = defaultData;
    }
    updateUserInfo(); updateWelcomeLocation(); updateProfileLocation();
    const isSeller = appState.userData.account_type === 'seller';
    const isDelivery = appState.userData.account_type === 'delivery';
    const isFounder = appState.userData.account_type === 'founder';
    toggleSellerMenuItem(isSeller);
    toggleDeliveryMenuItem(isDelivery);
    toggleFounderMenuItem(isFounder);
    if (isSeller) setTimeout(() => addSellerStoreTools(), 500);
    if (isFounder) { await initFounderSettings(); await loadFounderStats(); await loadPendingDeliveries(); }
    await updateCartBadgeFromDB();
    await loadUnreadNotificationsCount();
    setupRealtimeSubscriptions();
}
function updateUserInfo(isGuest = false) {
    const welcomeName = document.getElementById('welcomeName');
    const welcomeAvatar = document.getElementById('welcomeAvatar');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    const editAvatarImg = document.getElementById('editAvatarImg');
    const editAvatarIcon = document.getElementById('editAvatarIcon');
    if (isGuest || !appState.user) {
        welcomeName.textContent = 'مرحباً، زائر';
        welcomeAvatar.innerHTML = '<i class="fas fa-user"></i>';
        profileName.textContent = 'زائر';
        profileEmail.textContent = 'غير مسجل';
        profileAvatar.innerHTML = '<i class="fas fa-user"></i>';
        if (editAvatarImg) { editAvatarImg.style.display = 'none'; editAvatarIcon.style.display = 'block'; }
    } else {
        const name = appState.userData.name || appState.user.user_metadata?.full_name || appState.user.email?.split('@')[0] || 'مستخدم';
        const email = appState.user.email;
        const avatar = appState.userData.image_url || appState.user.user_metadata?.avatar_url;
        welcomeName.textContent = `مرحباً، ${name}`;
        profileName.textContent = name;
        profileEmail.textContent = email;
        if (avatar) {
            welcomeAvatar.innerHTML = `<img src="${avatar}" alt="صورة المستخدم">`;
            profileAvatar.innerHTML = `<img src="${avatar}" alt="صورة المستخدم">`;
            if (editAvatarImg) { editAvatarImg.src = avatar; editAvatarImg.style.display = 'block'; editAvatarIcon.style.display = 'none'; }
        } else { welcomeAvatar.innerHTML = '<i class="fas fa-user"></i>'; profileAvatar.innerHTML = '<i class="fas fa-user"></i>'; if (editAvatarImg) { editAvatarImg.style.display = 'none'; editAvatarIcon.style.display = 'block'; } }
    }
    if (appState.user) {
        document.getElementById('editName').value = appState.userData.name || '';
        document.getElementById('editPhone').value = appState.userData.phone || '';
        document.getElementById('editCenter').value = appState.userData.center || '';
        document.getElementById('editVillage').value = appState.userData.village || '';
        if (document.getElementById('editUsername')) document.getElementById('editUsername').value = appState.userData.username || '';
        if (document.getElementById('editBio')) document.getElementById('editBio').value = appState.userData.bio || '';
    }
}

// =================== إصلاح المنطقة (الموقع) ===================

// دالة مساعدة لتحميل القرى بناءً على المركز المختار
function loadVillagesForCenter(center, selectedVillage = '') {
    const villageSelect = document.getElementById('villageSelect');
    if (!villageSelect) return;
    villageSelect.innerHTML = '<option value="">اختر القرية</option>';
    if (center && appState.villagesByCenter[center]) {
        appState.villagesByCenter[center].forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            villageSelect.appendChild(opt);
        });
    }
    if (selectedVillage) {
        villageSelect.value = selectedVillage;
    }
}

// حفظ الموقع (بشكل متزامن مع قاعدة البيانات و localStorage)
async function saveLocation() {
    const governorate = document.getElementById('governorateSelect').value;
    const center = document.getElementById('centerSelect').value;
    const village = document.getElementById('villageSelect').value;

    if (!center || !village) {
        showToast('يرجى اختيار المركز والقرية', 'warning');
        return;
    }

    // تحديث الحالة العامة
    appState.location = { governorate, center, village };

    // إذا كان المستخدم مسجل دخول، احفظ في قاعدة البيانات
    if (appState.user) {
        try {
            const { error } = await supabaseClient.from('user_data').upsert({ 
                id: appState.user.id, 
                governorate, 
                center, 
                village 
            });
            if (error) throw error;
            // تحديث userData محلياً
            appState.userData.governorate = governorate;
            appState.userData.center = center;
            appState.userData.village = village;
        } catch (error) {
            showToast('فشل حفظ الموقع في قاعدة البيانات', 'error');
            console.error(error);
            return;
        }
    } else {
        // إذا كان زائر، احفظ في localStorage
        localStorage.setItem('misarUserLocation', JSON.stringify(appState.location));
    }

    // تحديث واجهة المستخدم
    updateWelcomeLocation();
    updateProfileLocation();

    // إظهار رسالة نجاح
    showToast('تم حفظ موقعك بنجاح', 'success');

    // العودة للشاشة السابقة
    if (appState.previousScreen === 'profileScreen') {
        showScreen('profileScreen');
    } else {
        showScreen('homeScreen');
    }
}

// فتح إعدادات الموقع مع تحميل البيانات المخزنة
function openLocationSettings() {
    showScreen('locationScreen');
    setTimeout(() => {
        // جلب الموقع المخزن
        const loc = appState.user ? appState.userData : appState.location;
        if (!loc) return;

        const center = loc.center || '';
        const village = loc.village || '';

        // تعيين المركز
        const centerSelect = document.getElementById('centerSelect');
        if (centerSelect) centerSelect.value = center;

        // تحميل القرى واختيار القرية المخزنة
        loadVillagesForCenter(center, village);
    }, 100);
}

// تحديث عرض الموقع في الترحيب
function updateWelcomeLocation() {
    const loc = appState.user ? appState.userData : appState.location;
    const el = document.getElementById('welcomeLocation');
    if (el && loc) {
        const parts = [loc.governorate || 'قنا', loc.center || '', loc.village || ''].filter(Boolean);
        el.textContent = `موقعك: ${parts.join(' - ')}`;
    } else if (el) {
        el.textContent = 'موقعك: غير محدد';
    }
}

// تحديث عرض الموقع في الملف الشخصي
function updateProfileLocation() {
    const loc = appState.user ? appState.userData : appState.location;
    const el = document.getElementById('profileLocation');
    if (el && loc && (loc.center || loc.village)) {
        const parts = [loc.governorate || 'قنا', loc.center || '', loc.village || ''].filter(Boolean);
        el.textContent = `المنطقة: ${parts.join(' - ')}`;
    } else if (el) {
        el.textContent = 'المنطقة: غير محددة';
    }
}

// =================== نهاية إصلاح المنطقة ===================

async function saveProfile() {
    if (!appState.user) return showToast('يجب تسجيل الدخول أولاً', 'warning');
    const name = document.getElementById('editName').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const username = document.getElementById('editUsername')?.value.trim();
    const bio = document.getElementById('editBio')?.value.trim();
    const updates = { id: appState.user.id };
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (appState.userData.account_type === 'seller') {
        if (username) { const { data: existing } = await supabaseClient.from('user_data').select('id').eq('username', username).neq('id', appState.user.id).maybeSingle(); if (existing) { showToast('اسم المستخدم مستخدم بالفعل', 'error'); return; } updates.username = username; }
        if (bio) updates.bio = bio;
    }
    if (Object.keys(updates).length === 1) return showToast('لا توجد تغييرات', 'info');
    showLoading(true);
    const { error } = await supabaseClient.from('user_data').upsert(updates);
    showLoading(false);
    if (error) showToast(error.message, 'error');
    else { appState.userData = { ...appState.userData, ...updates }; updateUserInfo(); showToast('تم حفظ التغييرات', 'success'); goBack(); if (appState.userData.account_type === 'seller') { addSellerStoreTools(); updateStoreTools(); } }
}
document.getElementById('avatarUpload')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file || !appState.user) return;
    if (!file.type.startsWith('image/')) return showToast('يرجى اختيار صورة', 'warning');
    if (file.size > 5 * 1024 * 1024) return showToast('الحد الأقصى 5 ميجابايت', 'warning');
    showLoading(true);
    try {
        const compressed = await compressImage(file, 512, 512, 0.8);
        const ext = file.name.split('.').pop();
        const path = `avatars/${appState.user.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage.from('user-images').upload(path, compressed);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabaseClient.storage.from('user-images').getPublicUrl(path);
        await supabaseClient.from('user_data').upsert({ id: appState.user.id, image_url: publicUrl });
        appState.userData.image_url = publicUrl;
        updateUserInfo();
        showToast('تم رفع الصورة الشخصية بنجاح', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { showLoading(false); }
});

// ========== دوال المؤسس ==========
async function loadGlobalFounderVisibility() {
    try { const { data, error } = await supabaseClient.from('founder_settings').select('page_visible').eq('id', 1).single(); if (!error && data) { appState.founderPageVisible = data.page_visible; } else { const saved = localStorage.getItem('founder_page_visible'); appState.founderPageVisible = saved !== null ? saved === 'true' : true; } } catch(e) { const saved = localStorage.getItem('founder_page_visible'); appState.founderPageVisible = saved !== null ? saved === 'true' : true; } const toggleSwitch = document.getElementById('toggleFounderPage'); if (toggleSwitch && appState.user && appState.userData.account_type === 'founder') { toggleSwitch.checked = appState.founderPageVisible; } }
async function initFounderSettings() { await loadGlobalFounderVisibility(); const toggleSwitch = document.getElementById('toggleFounderPage'); if (toggleSwitch && appState.user && appState.userData.account_type === 'founder') { toggleSwitch.removeEventListener('change', handleToggleChange); toggleSwitch.addEventListener('change', handleToggleChange); } }
async function handleToggleChange(e) { appState.founderPageVisible = e.target.checked; try { await supabaseClient.from('founder_settings').upsert({ id: 1, page_visible: appState.founderPageVisible, updated_at: new Date() }); } catch(error) { console.warn('فشل حفظ الإعدادات في قاعدة البيانات', error); } localStorage.setItem('founder_page_visible', appState.founderPageVisible); showToast(appState.founderPageVisible ? 'تم إظهار صفحة المؤسس للجميع' : 'تم إخفاء صفحة المؤسس عن الجميع', 'success'); }
async function loadFounderStats() {
    try { const { data, error } = await supabaseClient.from('founder_views').select('count').eq('id',1).single(); if (!error && data) appState.founderViews = data.count || 0; else appState.founderViews = parseInt(localStorage.getItem('founder_views') || '0'); } catch(e) { appState.founderViews = parseInt(localStorage.getItem('founder_views') || '0'); } const viewsEl = document.getElementById('founderViewsCount'); if (viewsEl) viewsEl.textContent = appState.founderViews;
    try { const { data, error } = await supabaseClient.from('founder_shares').select('count'); if (!error && data) { const total = data.reduce((sum, s) => sum + (s.count || 0), 0); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; } else { let total = 0; ['whatsapp','facebook','twitter','copy'].forEach(t => { total += parseInt(localStorage.getItem(`share_${t}`) || '0'); }); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; } } catch(e) { let total = 0; ['whatsapp','facebook','twitter','copy'].forEach(t => { total += parseInt(localStorage.getItem(`share_${t}`) || '0'); }); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; }
}
async function refreshFounderStats() { await loadFounderStats(); showToast('تم تحديث الإحصائيات', 'success'); }
async function trackFounderView() {
    try { await supabaseClient.rpc('increment_founder_view'); } catch(e) { let current = parseInt(localStorage.getItem('founder_views') || '0'); current++; localStorage.setItem('founder_views', current); appState.founderViews = current; }
    const viewsEl = document.getElementById('founderViewsCount'); if (viewsEl) viewsEl.textContent = appState.founderViews;
}
async function trackShare(shareType) {
    try { const { data, error } = await supabaseClient.from('founder_shares').select('count').eq('share_type', shareType).maybeSingle(); if (error) throw error; let newCount = 1; if (data && data.count !== undefined) { newCount = data.count + 1; await supabaseClient.from('founder_shares').update({ count: newCount, updated_at: new Date() }).eq('share_type', shareType); } else { await supabaseClient.from('founder_shares').insert({ share_type: shareType, count: 1 }); } const span = document.getElementById(`shareCount_${shareType}`); if (span) span.textContent = newCount; const { data: allShares } = await supabaseClient.from('founder_shares').select('count'); if (allShares) { const total = allShares.reduce((sum, s) => sum + (s.count || 0), 0); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; } } catch (err) { console.warn('فشل تحديث قاعدة بيانات المشاركات، استخدام localStorage', err); let localCount = parseInt(localStorage.getItem(`share_${shareType}`) || '0'); localCount++; localStorage.setItem(`share_${shareType}`, localCount); const span = document.getElementById(`shareCount_${shareType}`); if (span) span.textContent = localCount; let total = 0; ['whatsapp','facebook','twitter','copy'].forEach(t => { total += parseInt(localStorage.getItem(`share_${t}`) || '0'); }); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; }
}
async function loadShareCounts() {
    try { const { data, error } = await supabaseClient.from('founder_shares').select('share_type, count'); if (error) throw error; if (data && data.length) { data.forEach(item => { const span = document.getElementById(`shareCount_${item.share_type}`); if (span) span.textContent = item.count; }); const total = data.reduce((sum, s) => sum + (s.count || 0), 0); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; } else { ['whatsapp', 'facebook', 'twitter', 'copy'].forEach(type => { const count = localStorage.getItem(`share_${type}`) || 0; const span = document.getElementById(`shareCount_${type}`); if (span) span.textContent = count; }); let total = 0; ['whatsapp','facebook','twitter','copy'].forEach(t => { total += parseInt(localStorage.getItem(`share_${t}`) || '0'); }); const sharesEl = document.getElementById('founderSharesTotal'); if (sharesEl) sharesEl.textContent = total; } } catch (err) { console.warn(err); }
}
function getFounderShareLink() { const founderUsername = 'mohamed_saad'; const baseUrl = window.location.origin + window.location.pathname; return `${baseUrl}?founder=${founderUsername}`; }
async function shareFounderPage(method) {
    await loadGlobalFounderVisibility();
    if (!appState.founderPageVisible) { showToast('صفحة المؤسس مخفية حالياً من قبل الإدارة، لا يمكن مشاركتها', 'warning'); return; }
    const link = getFounderShareLink(); const text = `تعرف على مؤسس شركة Misar Systems المهندس محمد سعد وقصة نجاحه من خلال هذا الرابط:`;
    let shareUrl = '';
    switch(method) {
        case 'whatsapp': shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`; window.open(shareUrl, '_blank'); break;
        case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`; window.open(shareUrl, '_blank'); break;
        case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`; window.open(shareUrl, '_blank'); break;
        case 'copy': navigator.clipboard.writeText(link).then(() => showToast('تم نسخ رابط صفحة المؤسس بنجاح!', 'success')).catch(() => showToast('فشل نسخ الرابط، حاول يدوياً', 'error')); break;
    }
    trackShare(method);
}
function checkFounderParam() { const params = new URLSearchParams(window.location.search); const founder = params.get('founder'); if (founder && founder === 'mohamed_saad') { setTimeout(async () => { await loadGlobalFounderVisibility(); if (appState.founderPageVisible) { openFounderProfile(); } else { showToast('صفحة المؤسس غير متاحة حالياً', 'warning'); } const newUrl = window.location.origin + window.location.pathname; window.history.replaceState({}, document.title, newUrl); }, 1000); } }
function openFounderProfile() { closeChatbot(); document.getElementById('founderProfileScreen').classList.add('active'); loadShareCounts(); const shareLinkSpan = document.getElementById('founderShareLink'); if (shareLinkSpan) shareLinkSpan.textContent = getFounderShareLink(); trackFounderView(); }
function closeFounderProfile() { document.getElementById('founderProfileScreen').classList.remove('active'); openChatbot(); }
function contactDeveloper() { window.open('https://app.fastbots.ai/embed/cmillclid07mep81pmwkjqyq6', '_blank'); }
function openImageModal() { const img = document.querySelector('.founder-avatar img'); if (img) { document.getElementById('modalImage').src = img.src; document.getElementById('imageModal').classList.add('active'); } }
function closeImageModal(event) { if (event.target === document.getElementById('imageModal') || event.target.classList.contains('close-modal')) { document.getElementById('imageModal').classList.remove('active'); } }

// ========== طلبات انضمام المناديب ==========
async function loadPendingDeliveries() {
    if (!appState.user || appState.userData.account_type !== 'founder') return;
    try { const { data, error } = await supabaseClient.from('user_data').select('id, name, email, phone, center, created_at').eq('account_type', 'delivery').eq('status', 'pending'); if (error) throw error; const container = document.getElementById('pendingDeliveriesList'); if (!container) return; if (!data || data.length === 0) { container.innerHTML = '<p>لا توجد طلبات انضمام حالياً</p>'; return; } container.innerHTML = ''; data.forEach(del => { const div = document.createElement('div'); div.className = 'pending-item'; div.innerHTML = `<div class="pending-info"><div class="pending-name">${escapeHTML(del.name || del.email)}</div><div class="pending-email">${del.email} | ${del.phone || 'لا يوجد هاتف'} | المركز: ${del.center || 'غير محدد'}</div></div><div class="pending-actions"><button class="approve-btn" onclick="approveDeliveryPerson('${del.id}')">قبول</button><button class="reject-btn" onclick="rejectDeliveryPerson('${del.id}')">رفض</button></div>`; container.appendChild(div); }); } catch(err) { console.error(err); document.getElementById('pendingDeliveriesList').innerHTML = '<p>حدث خطأ في تحميل الطلبات</p>'; }
}
async function approveDeliveryPerson(userId) { showLoading(true); try { await supabaseClient.from('user_data').update({ status: 'approved' }).eq('id', userId); showToast('تم قبول المندوب', 'success'); await loadPendingDeliveries(); } catch(err) { showToast(err.message, 'error'); } finally { showLoading(false); } }
async function rejectDeliveryPerson(userId) { if (!confirm('هل أنت متأكد من رفض هذا المندوب؟ سيتم حذف حسابه.')) return; showLoading(true); try { await supabaseClient.from('user_data').delete().eq('id', userId); showToast('تم رفض المندوب وحذف الحساب', 'success'); await loadPendingDeliveries(); } catch(err) { showToast(err.message, 'error'); } finally { showLoading(false); } }

// ========== إشعارات واشتراكات ==========
async function sendNotification(userId, title, message, data = {}) {
    try { await supabaseClient.from('notifications').insert({ user_id: userId, title, message, data, created_at: new Date(), is_read: false }); } 
    catch (error) { console.warn('فشل إرسال الإشعار', error); }
}
async function loadUnreadNotificationsCount() { if (!appState.user) return; try { const { count, error } = await supabaseClient.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', appState.user.id).eq('is_read', false); if (!error) { const badge = document.getElementById('notificationBadge'); if (badge) { badge.textContent = count || 0; badge.style.display = count > 0 ? 'flex' : 'none'; } } } catch(e) { console.warn('فشل تحميل عدد الإشعارات', e); } }
function setupRealtimeSubscriptions() { if (!appState.user) return; if (appState.ordersSubscription) appState.ordersSubscription.unsubscribe(); appState.ordersSubscription = supabaseClient.channel('orders-channel').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => { console.log('Order change:', payload); if (appState.currentScreen === 'sellerDashboardScreen' && appState.userData.account_type === 'seller') refreshSellerDashboard(); else if (appState.currentScreen === 'deliveryDashboardScreen') refreshDeliveryDashboard(); else if (appState.currentScreen === 'ordersScreen') loadBuyerOrdersWithTimeline(); loadUnreadNotificationsCount(); }).subscribe(); if (appState.notificationsSubscription) appState.notificationsSubscription.unsubscribe(); appState.notificationsSubscription = supabaseClient.channel('notifications-channel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${appState.user.id}` }, (payload) => { showToast(payload.new.title, 'info'); loadUnreadNotificationsCount(); }).subscribe(); }

// ========== التنقل ==========
function showScreen(screenId) {
    if (screenId === 'sellerDashboardScreen') { if (!appState.user || appState.userData.account_type !== 'seller') { showToast('هذه الصفحة مخصصة للبائعين فقط', 'error'); showScreen('homeScreen'); return; } refreshSellerDashboard(); }
    if (screenId === 'deliveryDashboardScreen') { if (!appState.user || appState.userData.account_type !== 'delivery') { showToast('هذه الصفحة مخصصة للمندوبين فقط', 'error'); showScreen('homeScreen'); return; } refreshDeliveryDashboard(); }
    if (screenId === 'founderDashboardScreen') { if (!appState.user || appState.userData.account_type !== 'founder') { showToast('هذه الصفحة مخصصة للمؤسس فقط', 'error'); showScreen('homeScreen'); return; } loadFounderStats(); loadPendingDeliveries(); }
    if (screenId === 'ordersScreen') { loadBuyerOrdersWithTimeline(); }
    document.querySelectorAll('.screen').forEach(screen => { screen.classList.remove('active'); screen.classList.add('hidden'); });
    updateNavigation(screenId);
    const screen = document.getElementById(screenId);
    if (screen) { screen.classList.remove('hidden'); screen.classList.add('active'); appState.previousScreen = appState.currentScreen; appState.currentScreen = screenId; const backBtn = document.querySelector('.back-btn'); if (backBtn) backBtn.classList.toggle('active', screenId !== 'homeScreen' && screenId !== 'locationScreen'); }
    if (screenId === 'marketScreen') { document.getElementById('marketSearchInput').value = ''; document.getElementById('clearSearch').style.display = 'none'; loadMarketProducts(); }
    if (screenId === 'profileScreen') updateProfileLocation();
    if (screenId === 'editProfileScreen' && appState.user) updateProfileLocation();
    if (screenId === 'servicesScreen') loadServices();
    if (screenId === 'cartScreen') loadCart();
    if (screenId === 'loginScreen' || screenId === 'registerScreen') setTimeout(addInputInteractions, 50);
}
function goBack() { showScreen(appState.previousScreen || 'homeScreen'); }
function updateNavigation(screenId) { document.querySelectorAll('.nav-item').forEach((item, index) => { item.classList.remove('active'); if (screenId === 'homeScreen' && index === 0) item.classList.add('active'); else if (screenId === 'marketScreen' && index === 1) item.classList.add('active'); else if (screenId === 'servicesScreen' && index === 2) item.classList.add('active'); else if (screenId === 'cartScreen' && index === 3) item.classList.add('active'); else if (screenId === 'profileScreen' && index === 4) item.classList.add('active'); }); }
function skipLogin() { showScreen('homeScreen'); }
function addInputInteractions() {
    const inputs = document.querySelectorAll('#loginScreen input, #registerScreen input');
    const passwordInputs = document.querySelectorAll('#loginPassword, #registerPassword');
    inputs.forEach(inp => {
        inp.addEventListener('focus', () => setBearExpression('blink'));
        inp.addEventListener('blur', () => setBearExpression(''));
    });
    passwordInputs.forEach(pw => {
        pw.addEventListener('focus', () => setBearExpression('covering'));
        pw.addEventListener('blur', () => setBearExpression(''));
    });
}
// ========== دالة إظهار وإخفاء كلمة المرور ==========
function togglePasswordVisibility(inputId, toggleEl) {
    const input = document.getElementById(inputId);
    if (!input || !toggleEl) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    const icon = toggleEl.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;
// ========== دوال الدردشة ==========
function openChatbot() { document.getElementById('chatbotScreen').classList.add('active'); document.getElementById('chatbotBadge').style.display = 'none'; document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight; }
function closeChatbot() { document.getElementById('chatbotScreen').classList.remove('active'); }
function sendMessage() { const input = document.getElementById('chatInput'); const msg = input.value.trim(); if (!msg) return; addMessage(msg, 'user'); input.value = ''; setTimeout(() => { addMessage(getBotResponse(msg), 'bot'); document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight; }, 400); }
function sendSuggestion(text) { addMessage(text, 'user'); setTimeout(() => { addMessage(getBotResponse(text), 'bot'); document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight; }, 400); }
function addMessage(text, sender) { const container = document.getElementById('chatMessages'); const div = document.createElement('div'); div.className = `message ${sender}`; div.textContent = text; container.appendChild(div); container.scrollTop = container.scrollHeight; }
function getBotResponse(msg) { const m = msg.toLowerCase(); if (m.includes('السلام') || m.includes('اهلا')) return 'وعليكم السلام! كيف يمكنني مساعدتك؟ 😊'; if (m.includes('منتجات')) return 'لدينا إلكترونيات، أزياء، أثاث، أطعمة. تصفح المتجر!'; if (m.includes('اشتري') || m.includes('شراء')) return 'اذهب للمتجر، أضف المنتج للسلة ثم أكمل الطلب من صفحة السلة.'; if (m.includes('عروض')) return 'خصم 20% على الأثاث، وساعة هواوي بسعر مميز.'; if (m.includes('صيانة')) return 'خدمات الصيانة متوفرة: أجهزة، سباكة، كهرباء. احجز من قسم الخدمات.'; if (m.includes('طلب')) return 'تابع طلباتك من صفحة "طلباتي" في الملف الشخصي.'; if (m.includes('خدمة العملاء') || m.includes('الدعم')) return 'تواصل معنا: support@misar.com أو 19000.'; if (m.includes('شكرا')) return 'الشكر لله، دائمًا في خدمتك!'; return 'عذرًا، لم أفهم. جرب الاقتراحات أعلاه.'; }

// ========== دوال الأمان ==========
function showChangePasswordModal() { if (!appState.user) { showToast('يجب تسجيل الدخول أولاً', 'warning'); return; } document.getElementById('changePasswordModal').classList.add('active'); }
function showSecurityModal() { if (!appState.user) { showToast('يجب تسجيل الدخول أولاً', 'warning'); return; } document.getElementById('securityModal').classList.add('active'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }
function changePassword() { const oldPass = document.getElementById('oldPassword').value; const newPass = document.getElementById('newPassword').value; const confirmPass = document.getElementById('confirmNewPassword').value; if (!oldPass || !newPass || !confirmPass) { showToast('يرجى ملء جميع الحقول', 'warning'); return; } if (newPass !== confirmPass) { showToast('كلمة المرور الجديدة غير متطابقة', 'error'); return; } showToast('تم تغيير كلمة المرور (وهمي)', 'success'); closeModal('changePasswordModal'); document.getElementById('oldPassword').value = ''; document.getElementById('newPassword').value = ''; document.getElementById('confirmNewPassword').value = ''; }
function saveSecuritySettings() { const twoFactor = document.getElementById('twoFactorCheck').checked; showToast(`تم حفظ إعدادات الأمان (المصادقة الثنائية: ${twoFactor ? 'مفعلة' : 'غير مفعلة'})`, 'success'); closeModal('securityModal'); }

// ========== تصدير الدوال العامة ==========
window.supabaseClient = supabaseClient;
window.appState = appState;
window.compressImage = compressImage;
window.uploadProductImages = uploadProductImages;
window.showScreen = showScreen;
window.goBack = goBack;
window.skipLogin = skipLogin;
window.openLocationSettings = openLocationSettings;
window.setBearExpression = setBearExpression;
window.showBearReaction = showBearReaction;
window.showLoading = showLoading;
window.showToast = showToast;
window.escapeHTML = escapeHTML;
window.signInWithGoogle = signInWithGoogle;
window.signInWithEmail = signInWithEmail;
window.signUpWithEmail = signUpWithEmail;
window.logout = logout;
window.switchAccount = switchAccount;
window.confirmLogout = confirmLogout;
window.saveProfile = saveProfile;
window.showChangePasswordModal = showChangePasswordModal;
window.showSecurityModal = showSecurityModal;
window.closeModal = closeModal;
window.changePassword = changePassword;
window.saveSecuritySettings = saveSecuritySettings;
window.openChatbot = openChatbot;
window.closeChatbot = closeChatbot;
window.sendMessage = sendMessage;
window.sendSuggestion = sendSuggestion;
window.openFounderProfile = openFounderProfile;
window.closeFounderProfile = closeFounderProfile;
window.contactDeveloper = contactDeveloper;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.shareFounderPage = shareFounderPage;
window.trackShare = trackShare;
window.loadShareCounts = loadShareCounts;
window.getFounderShareLink = getFounderShareLink;
window.refreshFounderStats = refreshFounderStats;
window.approveDeliveryPerson = approveDeliveryPerson;
window.rejectDeliveryPerson = rejectDeliveryPerson;
window.loadPendingDeliveries = loadPendingDeliveries;
window.loadUserData = loadUserData;
window.updateUserInfo = updateUserInfo;
window.updateWelcomeLocation = updateWelcomeLocation;
window.updateProfileLocation = updateProfileLocation;
window.saveLocation = saveLocation;
window.loadUnreadNotificationsCount = loadUnreadNotificationsCount;
window.setupRealtimeSubscriptions = setupRealtimeSubscriptions;
window.sendNotification = sendNotification;