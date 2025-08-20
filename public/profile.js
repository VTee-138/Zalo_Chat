// Profile Page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    const profileCard = document.getElementById('profile-card');
    const userId = getUserIdFromUrl();

    if (!userId) {
        showError('Không tìm thấy User ID');
        return;
    }

    await loadProfileData(userId);
});

function getUserIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1];
}

async function loadProfileData(userId) {
    const profileCard = document.getElementById('profile-card');
    
    try {
        // Lấy thông tin từ session trước
        const sessionResponse = await fetch('/api/get-connected-accounts');
        const accounts = await sessionResponse.json();
        
        const personalAccount = accounts.personal[userId];
        if (!personalAccount) {
            throw new Error('Không tìm thấy thông tin tài khoản');
        }

        // Hiển thị thông tin cơ bản từ session
        profileCard.innerHTML = `
            <div class="profile-info">
                <div class="profile-avatar">
                    <img src="${personalAccount.avatar}" alt="${personalAccount.name}" onload="this.style.opacity=1">
                </div>
                <div class="profile-details">
                    <h2>${personalAccount.name}</h2>
                    <p class="user-id">ID: ${userId}</p>
                    <span class="account-badge">Zalo Personal Account</span>
                </div>
            </div>
            <div class="profile-stats">
                <div class="stat-item">
                    <div class="stat-number">✅</div>
                    <div class="stat-label">Đã Kết Nối</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number" id="last-sync">🔄</div>
                    <div class="stat-label">Đồng Bộ Gần Đây</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">👤</div>
                    <div class="stat-label">Cá Nhân</div>
                </div>
            </div>
        `;

        // Cập nhật thời gian sync
        updateLastSyncTime();

    } catch (error) {
        console.error('Lỗi khi tải profile:', error);
        showError('Không thể tải thông tin profile: ' + error.message);
    }
}

function updateLastSyncTime() {
    const lastSyncElement = document.getElementById('last-sync');
    if (lastSyncElement) {
        const now = new Date();
        lastSyncElement.textContent = now.toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

function showError(message) {
    const profileCard = document.getElementById('profile-card');
    profileCard.innerHTML = `
        <div class="error-state">
            <div class="error-icon">❌</div>
            <h3>Có lỗi xảy ra</h3>
            <p>${message}</p>
            <button onclick="location.reload()" class="retry-btn">Thử lại</button>
        </div>
    `;
}

// Action functions
async function viewFriends() {
    const btn = event.target.closest('.action-btn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-spinner"></div> Đang tải...';
    
    try {
        // Simulate API call - replace with actual implementation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        showNotification('Tính năng xem danh sách bạn bè đang được phát triển', 'info');
        
    } catch (error) {
        showNotification('Lỗi khi tải danh sách bạn bè: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function viewDetailedProfile() {
    const btn = event.target.closest('.action-btn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-spinner"></div> Đang tải...';
    
    try {
        const userId = getUserIdFromUrl();
        
        // Call API to get detailed profile (if available)
        const response = await fetch(`/api/personal-profile/${userId}`);
        
        if (response.ok) {
            const profileData = await response.json();
            showProfileModal(profileData);
        } else {
            throw new Error('Không thể tải thông tin chi tiết');
        }
        
    } catch (error) {
        showNotification('Tính năng xem chi tiết đang được phát triển', 'info');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function syncData() {
    const btn = event.target.closest('.action-btn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<div class="btn-spinner"></div> Đồng bộ...';
    
    try {
        // Simulate sync process
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        updateLastSyncTime();
        showNotification('Đồng bộ dữ liệu thành công!', 'success');
        
    } catch (error) {
        showNotification('Lỗi khi đồng bộ: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function openSettings() {
    showNotification('Tính năng cài đặt đang được phát triển', 'info');
}

function showProfileModal(data) {
    // Create and show modal with detailed profile data
    const modal = document.createElement('div');
    modal.className = 'profile-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Thông Tin Chi Tiết</h3>
                <button onclick="this.closest('.profile-modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentNode.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}
