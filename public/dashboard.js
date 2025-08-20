document.addEventListener('DOMContentLoaded', async () => {
    const channelList = document.getElementById('channel-list');

    try {
        const response = await fetch('/api/get-connected-accounts');
        const accounts = await response.json();

        channelList.innerHTML = ''; // Xóa loading text

        const totalAccounts = Object.keys(accounts.oas || {}).length + Object.keys(accounts.personal || {}).length;

        if (totalAccounts === 0) {
            channelList.innerHTML = `
                <div class="no-channels">
                    <p>🔗 Chưa có tài khoản nào được kết nối</p>
                    <p>Vui lòng kết nối tài khoản Zalo để bắt đầu.</p>
                    <a href="/" class="connect-button">Về trang chính</a>
                </div>
            `;
            return;
        }

        // Hiển thị Official Accounts
        if (Object.keys(accounts.oas || {}).length > 0) {
            const oaSection = document.createElement('div');
            oaSection.className = 'account-section';
            oaSection.innerHTML = '<h2 class="section-title">🏢 Official Accounts</h2>';
            channelList.appendChild(oaSection);

            for (const oa_id in accounts.oas) {
                const oa = accounts.oas[oa_id];
                const channelCard = document.createElement('div');
                channelCard.className = 'channel-card-wrapper';
                channelCard.innerHTML = `
                    <a href="/chat/${oa_id}" class="channel-card oa-card">
                        <div class="channel-card-content">
                            <div class="channel-avatar">
                                <img src="${oa.avatar}" alt="Zalo OA">
                            </div>
                            <div class="channel-info">
                                <h3>${oa.name}</h3>
                                <p>ID: ${oa_id}</p>
                                <span class="channel-type">Zalo Official Account</span>
                            </div>
                            <div class="channel-arrow">→</div>
                        </div>
                    </a>
                    <div class="channel-actions">
                        <button class="crawl-btn" onclick="crawlMessages('${oa_id}')">
                            📥 Crawl Tin Nhắn
                        </button>
                    </div>
                `;
                channelList.appendChild(channelCard);
            }
        }

        // Hiển thị Personal Accounts
        if (Object.keys(accounts.personal || {}).length > 0) {
            const personalSection = document.createElement('div');
            personalSection.className = 'account-section';
            personalSection.innerHTML = '<h2 class="section-title">👤 Tài Khoản Cá Nhân</h2>';
            channelList.appendChild(personalSection);

            for (const user_id in accounts.personal) {
                const user = accounts.personal[user_id];
                const channelCard = document.createElement('div');
                channelCard.className = 'channel-card-wrapper';
                channelCard.innerHTML = `
                    <a href="/profile/${user_id}" class="channel-card personal-card">
                        <div class="channel-card-content">
                            <div class="channel-avatar">
                                <img src="${user.avatar}" alt="${user.name}">
                            </div>
                            <div class="channel-info">
                                <h3>${user.name}</h3>
                                <p>ID: ${user_id}</p>
                                <span class="channel-type">Zalo Personal Account</span>
                            </div>
                            <div class="channel-arrow">→</div>
                        </div>
                    </a>
                    <div class="channel-actions">
                        <button class="profile-btn" onclick="viewProfile('${user_id}')">
                            �️ Xem Profile
                        </button>
                    </div>
                `;
                channelList.appendChild(channelCard);
            }
        }
    } catch (error) {
        console.error('Lỗi khi tải danh sách tài khoản:', error);
        channelList.innerHTML = `
            <div class="error-message">
                <p>❌ Lỗi khi tải danh sách tài khoản</p>
                <button onclick="location.reload()">Thử lại</button>
            </div>
        `;
    }
});

// Function để crawl tin nhắn
async function crawlMessages(oa_id) {
    const crawlBtn = document.querySelector(`button[onclick="crawlMessages('${oa_id}')"]`);
    const originalText = crawlBtn.innerHTML;
    
    // Disable button và hiển thị loading
    crawlBtn.disabled = true;
    crawlBtn.innerHTML = '🔄 Đang crawl...';
    crawlBtn.classList.add('loading');
    
    try {
        const response = await fetch(`/api/crawl-messages/${oa_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ limit: 50 }) // Crawl 50 conversations mỗi lần
        });
        
        const result = await response.json();
        
        if (result.success) {
            crawlBtn.innerHTML = '✅ Hoàn thành!';
            crawlBtn.classList.remove('loading');
            crawlBtn.classList.add('success');
            
            // Hiển thị thông báo thành công
            showNotification('Crawl tin nhắn thành công! Hãy vào chat để xem.', 'success');
            
            // Reset button sau 3 giây
            setTimeout(() => {
                crawlBtn.innerHTML = originalText;
                crawlBtn.disabled = false;
                crawlBtn.classList.remove('success');
            }, 3000);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Lỗi khi crawl tin nhắn:', error);
        crawlBtn.innerHTML = '❌ Lỗi';
        crawlBtn.classList.remove('loading');
        crawlBtn.classList.add('error');
        
        showNotification('Lỗi khi crawl tin nhắn: ' + error.message, 'error');
        
        // Reset button sau 3 giây
        setTimeout(() => {
            crawlBtn.innerHTML = originalText;
            crawlBtn.disabled = false;
            crawlBtn.classList.remove('error');
        }, 3000);
    }
}

// Function để hiển thị notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentNode.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Function để xem profile
async function viewProfile(user_id) {
    const profileBtn = document.querySelector(`button[onclick="viewProfile('${user_id}')"]`);
    const originalText = profileBtn.innerHTML;
    
    // Disable button và hiển thị loading
    profileBtn.disabled = true;
    profileBtn.innerHTML = '🔄 Đang tải...';
    
    try {
        // Tạm thời hiển thị thông báo
        showNotification(`Đang phát triển tính năng xem profile cho user ${user_id}`, 'info');
        
        // Reset button sau 2 giây
        setTimeout(() => {
            profileBtn.innerHTML = originalText;
            profileBtn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Lỗi khi xem profile:', error);
        profileBtn.innerHTML = '❌ Lỗi';
        
        setTimeout(() => {
            profileBtn.innerHTML = originalText;
            profileBtn.disabled = false;
        }, 2000);
    }
}

// Expose functions to global scope
window.crawlMessages = crawlMessages;
window.viewProfile = viewProfile;