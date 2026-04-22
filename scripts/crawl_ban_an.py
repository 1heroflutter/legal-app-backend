import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# --- CẤU HÌNH ---
chrome_options = Options()
chrome_options.add_experimental_option("detach", True)
chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
chrome_options.add_argument("--disable-blink-features=AutomationControlled")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
wait = WebDriverWait(driver, 10)

# XPATH ĐỊNH NGHĨA SẴN
XPATH_HARDCORE = "//*[contains(@class, 'LevelTitle') and text()='Hardcore']"
XPATH_PLAY = "//button[contains(., 'Play')]"
XPATH_GO = "//button[contains(., 'Go')]"
XPATH_CASHOUT = "//button[contains(., 'Cash out')]"
XPATH_TUMBLER = "//span[contains(@class, 'selection-ico-tumbler')]"
# Xpath nút "Chơi" nằm chính xác trong Modal thông báo chơi thật
XPATH_MODAL_PLAY_BTN = "//div[contains(@class, 'play-for-real-modal')]//span[contains(@class, 'ui-caption') and text()='Chơi']"

def switch_to_game_context():
    """Nhảy vào Iframe chứa Game"""
    driver.switch_to.default_content()
    try:
        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        if len(iframes) > 0:
            driver.switch_to.frame(iframes[0])
            return True
    except:
        pass
    return False

def is_demo_mode():
    """Kiểm tra xem có đang ở chế độ Demo không"""
    driver.switch_to.default_content()
    try:
        # Kiểm tra class của nút gạt để xem nó có đang được 'check' (Real) hay không
        tumbler = driver.find_element(By.XPATH, XPATH_TUMBLER)
        class_name = tumbler.get_attribute("class")
        # Nếu class KHÔNG chứa 'checked' thì thường là Demo (tùy giao diện web)
        # Hoặc dựa vào URL có chứa 'demo=1'
        if "checked" in class_name:
            return False # Đang là Real
        return True # Đang là Demo
    except:
        return True # Mặc định coi là Demo nếu không tìm thấy nút gạt ở trang chính

def force_click_js(xpath, description):
    try:
        element = driver.find_element(By.XPATH, xpath)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
        driver.execute_script("arguments[0].click();", element)
        print(f"[OK] {description}")
        return True
    except:
        return False

def ensure_demo_mode():
    """Bắt buộc quay về chế độ Demo nếu đang ở Real"""
    if not is_demo_mode():
        print(">> Phát hiện đang ở Real Money! Đang gạt về Demo...")
        force_click_js(XPATH_TUMBLER, "Gạt về Demo")
        time.sleep(3)
    else:
        print("[CHECK] Trạng thái: Đang ở Demo.")

try:
    print("Truy cập... Bạn có 20s để đăng nhập.")
    driver.get("https://1xlite-044647.top/vi/slots/game/112454/chicken-road?demo=1")
    driver.maximize_window()
    time.sleep(30)

    while True:
        # BƯỚC KIỂM TRA ĐẦU MỖI TURN
        ensure_demo_mode()
        
        print("\n--- CHU KỲ DEMO ---")
        switch_to_game_context()
        time.sleep(2)
        force_click_js(XPATH_HARDCORE, "Chọn Hardcore")

        # Vòng lặp bấm nút Demo
        while True:
            # 1. Kiểm tra Modal Chơi thật (phải nhảy ra ngoài iframe)
            driver.switch_to.default_content()
            modals = driver.find_elements(By.XPATH, "//div[contains(@class, 'play-for-real-modal')]")
            if len(modals) > 0:
                print(">> Xuất hiện Modal Chơi Thật. Đang xác nhận...")
                force_click_js(XPATH_MODAL_PLAY_BTN, "Xác nhận Chơi Thật")
                break
            
            # 2. Nếu không có modal, tiếp tục bấm nút trong game
            switch_to_game_context()
            if len(driver.find_elements(By.XPATH, XPATH_GO)) > 0:
                force_click_js(XPATH_GO, "Bấm GO")
            else:
                force_click_js(XPATH_PLAY, "Bấm PLAY")
            
            time.sleep(2)

        # CHUYỂN SANG REAL
        print("Đang chờ chuyển sang Real...")
        time.sleep(10)

        # --- THAO TÁC TIỀN THẬT ---
        print("--- THAO TÁC TIỀN THẬT ---")
        switch_to_game_context()
        
        force_click_js("//button[text()='MIN']", "MIN")
        time.sleep(1.5)
        force_click_js(XPATH_HARDCORE, "Hardcore (Real)")
        time.sleep(1.5)
        
        force_click_js(XPATH_PLAY, "PLAY (Duy nhất 1 lần)")
        
        time.sleep(3)
        if not force_click_js(XPATH_CASHOUT, "CASH OUT"):
            print("Nhân vật chết - Không thể Cash Out")

        # KẾT THÚC TURN - QUAY LẠI DEMO
        print("Kết thúc ván tiền thật. Đang quay lại Demo...")
        driver.switch_to.default_content()
        force_click_js(XPATH_TUMBLER, "Gạt nút về Demo")
        time.sleep(5)

except Exception as e:
    print(f"Lỗi: {e}")