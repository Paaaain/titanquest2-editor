# TÀI LIỆU KỸ THUẬT & WIKI: HỆ THỐNG AFFIX & CATALOG TITAN QUEST 2

Tài liệu này ghi lại toàn bộ cấu trúc dữ liệu, quy tắc bóc tách CSV text game, các điểm dị biệt (Spirit Mastery, Forge, Unique) và quy trình chuẩn để kiểm tra (audit), đóng gói (build catalog) và triển khai (deploy) cho **Titan Quest 2 Item Editor**.

---

## 1. Cấu Trúc Tổng Thể Dữ Liệu Catalog (`catalog.js`)

Catalog được nén bằng `gzip + base64` và nạp trực tiếp vào biến toàn cục `window.__CATALOG__`. Khi giải nén, đối tượng catalog gồm các trường chính:

| Trường | Ý nghĩa | Mô tả |
| :--- | :--- | :--- |
| `CAT.a` | **Affix Database** | Chứa danh sách tất cả Affixes (Prefix, Suffix, Implicit, Unique). Key là đường dẫn asset trong game (`/Game/TQ2/Items/Affixes/...`). |
| `CAT.names` | **Localization & Meta** | Chứa tiêu đề song ngữ (Anh/Việt), phân loại (`Prefix`/`Suffix`), mô tả tooltip gốc và danh sách tooltip theo từng bậc (`tierTooltips`). |
| `CAT.i` | **Item Templates** | Danh sách tất cả khuôn mẫu trang bị (Vũ khí, Giáp, Trang sức, Relic) bóc tách từ game. |
| `CAT.s` | **Roll Ranges** | Bảng giới hạn giá trị roll thực tế in-game cho từng cặp `[AffixPath \| GameplayEffectPath]`. |
| `CAT.auth` | **Authentic Affixes** | Danh sách affix đã được xác thực xuất hiện tự nhiên từ các file save thật của game. |

---

## 2. Quy Tắc Bóc Tách CSV Từ `Text/Items/`

Game Titan Quest 2 định nghĩa text và tooltip trong các file CSV với 2 dạng cấu trúc hoàn toàn khác nhau cần đặc biệt lưu ý:

### A. Dạng phân cấp `Levels(N)` (Earth, Storm, Warfare, Rogue...)
- **File nguồn:** `st_item_names_*.csv`, `st_item_effectdesc_generic.csv`, `st_item_effectdesc_rare.csv`.
- **Cấu trúc dòng:**
  ```csv
  "da_suffix_1_ActiveCapacityEarth.m_Levels.Levels(0).Levels.AffixEffects(0).AffixEffects.TooltipText","{value}|fmt(sign=true) Capacity to Earth Tier 1 Active Skills",""
  "prefix_1_PerIncreasedSpiritDmg.Levels(0).TitleText","Faint",""
  ```
- **Quy tắc phân giải:**
  - `Levels(N)` là chỉ số bậc bắt đầu từ **0** (`Levels(0)` là Bậc 1, `Levels(5)` là Bậc 6).
  - Khóa chứa `TitleText` được lưu vào `affixTierMap` (tên của bậc).
  - Khóa chứa `TooltipText` được lưu vào `affixTierTooltips` (nội dung hiệu ứng của bậc).

### B. Dạng phẳng `_TN` (Đặc thù Tinh thông Spirit)
- **File nguồn:** `st_item_effectdesc_generic.csv`.
- **Cấu trúc dòng:**
  ```csv
  "da_suffix_1_PassiveLevelSpirit_T1","{value}|fmt(sign=true) Level to Spirit Tier 1 Passive Skills",""
  "da_suffix_1_CapacitySpirit_T1","{value}|fmt(sign=true) Capacity to Spirit Tier 1 Active Skills",""
  ```
- **Quy tắc phân giải:**
  - `_T1` đến `_T6` là chỉ số bậc bắt đầu từ **1**, khi nạp vào hệ thống phải trừ 1 (`T1 -> 0`, `T6 -> 5`).
  - **Quy tắc Alias cực kỳ quan trọng:** CSV game đặt tên là `suffix_1_CapacitySpirit_TN`, nhưng asset thực tế trong game là `da_suffix_1_ActiveCapacitySpirit`. Do đó trong `build_catalog.js` bắt buộc phải có alias:
    ```javascript
    if (baseKey === 'suffix_1_CapacitySpirit') baseKey = 'suffix_1_ActiveCapacitySpirit';
    ```

### C. Dạng Affix Kỹ năng Toàn cục (Global Mastery Bonuses)
- **Cấu trúc dòng:**
  ```csv
  "prefix_0_PointsToEarthActives.TooltipText","{value}|fmt(sign=true) Capacity to all Earth Active Skills",""
  "prefix_0_PointsToAllPassives.TooltipText","{value}|fmt(sign=true) Level to all Passive Skills",""
  ```
- **Quy tắc phân giải:**
  - Đây là affix dạng `prefix_0_` (cộng thẳng cho toàn bộ kỹ năng không phân biệt bậc), không có nhiều bậc trong CSV.
  - Sẽ gán trực tiếp vào thuộc tính `tooltip` chung của Affix thay vì phân theo `tierTooltips`.

---

## 3. Quy Tắc GameplayEffects & Chống Mất Option In-Game

### A. Phân giải GameplayEffects (GE)
- **Nhóm `PointsTo...`:** Toàn bộ nhóm này bắt đầu bằng `prefix_0_`. Trong bộ cài game TQ2 **chỉ có duy nhất** blueprint `bp_ge_affix_0_${cleanStat}`.
- **CẢNH BÁO:** Tuyệt đối không thêm `bp_ge_affix_1_...` vào danh sách GE của `PointsTo`. Nếu trong template có bất kỳ GameplayEffect ảo/không tồn tại nào, Unreal Engine sẽ coi slot Affix bị hỏng và **tự động xóa sổ (strip) toàn bộ slot đó khi nạp game**.

### B. Giá trị Scale mặc định
- Đối với chỉ số Cấp kỹ năng (`PointsTo`, `PassiveLevel`) và Sức chứa (`Capacity`, `ActiveCapacity`): Giá trị Scale mặc định trong template **bắt buộc là `1.0`** (tương đương +1 Cấp / +1 Sức chứa).

### C. Khả năng tương thích Vị trí Trang bị (Item Slots)
- `PassiveLevel<Mastery>` (Suffix): Hợp lệ trên **Mũ (Helmet)**, **Dây chuyền (Amulet)**, **Relic**.
- `PointsTo<Mastery>Passives` / `PointsToAllPassives` (Prefix): Hợp lệ trên **Mũ (Helmet)**, **Dây chuyền (Amulet)**, **Relic**.
- `ActiveCapacity<Mastery>` (Suffix): Hợp lệ trên **Mũ (Helmet)**, **Nhẫn (Ring)**, **Dây chuyền (Amulet)**, **Relic**.

---

## 4. Cách UI Item Editor (`item-editor.js`) Render Tooltip

Trong `js/ui/item-editor.js`:
- Cả thẻ xem trước **Live Tooltip Preview** và dòng hiển thị **Effect** trong thẻ Affix đều tự động đọc `tierTooltips[curTier]`:
  ```javascript
  const curTier = lvl ? lvl.v : 0;
  const tierDesc = (metaObj.tierTooltips && metaObj.tierTooltips[curTier]);
  if (tierDesc) {
    lineText = tierDesc.replace(/\{value\}(\|fmt\([^)]*\))?/gi, (valNum >= 0 ? '+' : '') + valStr)
                       .replace(/\{Value\}(\|fmt\([^)]*\))?/gi, (valNum >= 0 ? '+' : '') + valStr);
  }
  ```
- Nhờ đó, khi người dùng đổi qua lại giữa Tier 0 (Bậc 1), Tier 1 (Bậc 2), Tier 2 (Bậc 3)... màn hình xem trước sẽ nhảy ngay lập tức thành dòng mô tả chuẩn (ví dụ `+1 Level to Spirit Tier 2 Passive Skills`).

---

## 5. Quy Trình Chuẩn Khi Cập Nhật / Fix Affix Mới

Bất cứ khi nào có bản cập nhật file Text tiếng Anh/tiếng Việt mới hoặc thêm Affix/Khuôn mẫu mới, thực hiện chuẩn theo 3 bước:

### Bước 1: Build lại Catalog
```powershell
node js/data/build_catalog.js
```
*Đảm bảo console báo thành công và hiển thị đủ >500 affixes, >2000 item templates.*

### Bước 2: Chạy Script Audit Kiểm Tra Độ Chính Xác
```powershell
node scratch/correct_audit.js
```
*Script sẽ kiểm tra toàn bộ 26 nhóm kỹ năng Tinh thông (Earth, Forge, Rogue, Spirit, Storm, Warfare, All) xem có đầy đủ 6 tierTooltips, GameplayEffects và Tooltip hợp lệ hay không. Đảm bảo kết quả trả về `✅ Tất cả đều OK!`.*

### Bước 3: Deploy Lên Vercel
```powershell
npx vercel --prod --yes
```
*Trang web sẽ tự động được cập nhật tại: https://titanquest2-editor.vercel.app/*

---

## 6. Danh Sách Script Tiện Ích

- `scratch/correct_audit.js`: Script kiểm tra toàn diện tính toàn vẹn của 26 affix Tinh thông.
- `js/data/build_catalog.js`: Trình biên dịch dữ liệu từ CSV và template vào `catalog.js`.
- `.agents/skills/tq2-catalog-build/SKILL.md`: Skill chuẩn cho AI Agent hỗ trợ code & maintain dự án.
