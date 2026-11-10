# Copy

Tone: short, plain, specific; say what happened and what to do. Placeholders in `{braces}`.
One text column per supported language (RULE-17, F-018); every language has the same
placeholders. Stays as written in every language: the product name, "PNG", "GitHub".
Numbers in placeholders are formatted for the active language. Strings with a count give one
form per plural category (en-US: `one` / `other`; vi-VN: one form).

## Tools
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-tool.select** | Select | Chọn | |
| **COPY-tool.rectangle** | Rectangle | Hình chữ nhật | |
| **COPY-tool.ellipse** | Ellipse | Hình elip | |
| **COPY-tool.line** | Line | Đường thẳng | |
| **COPY-tool.arrow** | Arrow | Mũi tên | |
| **COPY-tool.pen** | Pen | Bút vẽ | |
| **COPY-tool.highlight** | Highlight | Tô sáng | |
| **COPY-tool.text** | Text | Chữ | |
| **COPY-tool.step** | Step | Bước | Numbered badge |
| **COPY-tool.redact** | Redact | Che thông tin | |
| **COPY-tool.crop** | Crop | Cắt | |
| **COPY-tool.shortcut_hint** | {tool} ({key}) | {tool} ({key}) | Tooltip; {key} per RULE-19 |

## Actions
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-action.open** | Open image | Mở ảnh | |
| **COPY-action.copy** | Copy | Sao chép | Copies the result image |
| **COPY-action.download** | Download | Tải xuống | |
| **COPY-action.undo** | Undo | Hoàn tác | |
| **COPY-action.redo** | Redo | Làm lại | |
| **COPY-action.delete** | Delete | Xoá | |
| **COPY-action.duplicate** | Duplicate | Nhân bản | |
| **COPY-action.bring_forward** | Bring forward | Đưa lên trên | |
| **COPY-action.send_backward** | Send backward | Đưa xuống dưới | |
| **COPY-action.crop_reset** | Reset crop | Bỏ cắt | |
| **COPY-action.zoom_in** | Zoom in | Phóng to | |
| **COPY-action.zoom_out** | Zoom out | Thu nhỏ | |
| **COPY-action.zoom_fit** | Fit to view | Vừa khung nhìn | |
| **COPY-action.zoom_actual** | Actual size | Kích thước thật | 100 % |
| **COPY-action.clear** | Start over | Bắt đầu lại | Removes the image |
| **COPY-action.shortcuts** | Keyboard shortcuts | Phím tắt | |
| **COPY-action.more** | More actions | Thao tác khác | Overflow menu |
| **COPY-action.cancel** | Cancel | Huỷ | |
| **COPY-action.replace** | Replace | Thay ảnh | Confirms replacing the image |
| **COPY-action.close** | Close | Đóng | |

## Style & canvas
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-style.color** | Color | Màu | |
| **COPY-style.size** | Size | Cỡ | Stroke or text size |
| **COPY-style.size_s** | Small | Nhỏ | |
| **COPY-style.size_m** | Medium | Vừa | |
| **COPY-style.size_l** | Large | Lớn | |
| **COPY-style.color_custom** | Custom color | Màu tùy chọn | Accessible name of the custom swatch before a custom colour is picked (F-019) |
| **COPY-style.color_custom_value** | Custom color {hex} | Màu tùy chọn {hex} | Accessible name of the custom swatch once a colour is picked; hex shown in uppercase, e.g. #1E90FF, whatever case the picker reports (F-019) |
| **COPY-style.size_px** | Size in pixels | Cỡ (pixel) | Label of the size field and slider (F-019) |
| **COPY-style.size_value** | {value} px | {value} px | A custom size, e.g. in the narrow summary bar's detail (F-019) |
| **COPY-style.fill** | Fill | Tô nền | |
| **COPY-style.fill_none** | None | Không | |
| **COPY-style.fill_solid** | Solid | Đặc | |
| **COPY-style.fill_translucent** | Translucent | Bán trong suốt | |
| **COPY-style.fill_color** | Fill color | Màu tô | Colour of a rectangle's or ellipse's fill (F-020) |
| **COPY-style.text_background** | Background | Nền chữ | A text's background box; its choices reuse COPY-style.fill_none, fill_solid, fill_translucent (F-020) |
| **COPY-style.text_background_color** | Background color | Màu nền chữ | Colour of a text's background box (F-020) |
| **COPY-style.strength** | Strength | Độ mạnh | Blur and pixelate |
| **COPY-color.red** | Red | Đỏ | |
| **COPY-color.orange** | Orange | Cam | |
| **COPY-color.yellow** | Yellow | Vàng | |
| **COPY-color.green** | Green | Xanh lá | |
| **COPY-color.blue** | Blue | Xanh dương | |
| **COPY-color.purple** | Purple | Tím | |
| **COPY-color.black** | Black | Đen | |
| **COPY-color.white** | White | Trắng | |
| **COPY-canvas.title** | Canvas | Khung ảnh | Subject of the narrow summary bar when canvas settings show, and the heading of the wide panel's padding and background, below the drawing colour (D-046, D-047) |
| **COPY-style.sheet_toggle** | Style options | Tùy chọn kiểu dáng | Start of the narrow summary bar's accessible name: "{sheet_toggle}: {sheet_summary}" |
| **COPY-style.sheet_summary** | {subject} · {detail} | {subject} · {detail} | Narrow summary bar; subject: the tool, the selected kind, COPY-a11y.selected_count, COPY-canvas.title or COPY-tool.crop; detail: COPY-style.size_s/m/l or, for a custom size, COPY-style.size_value (for a redaction: the subject is its kind, COPY-redact.solid, COPY-redact.blur or COPY-redact.pixelate, followed for blur and pixelate by COPY-redact.not_secure_short shown as the same tag as on the panel's choices (D-031), and the detail its strength for blur and pixelate, none for solid); for the canvas, COPY-canvas.padding, a space, then COPY-canvas.padding_none or COPY-style.size_s/m/l (e.g. "Padding None"); or COPY-crop.size |
| **COPY-canvas.padding** | Padding | Khoảng đệm | |
| **COPY-canvas.padding_none** | None | Không | |
| **COPY-canvas.background** | Background | Nền | |
| **COPY-canvas.transparent** | Transparent | Trong suốt | |
| **COPY-canvas.padding_unavailable** | Larger padding would make the image too big to export. | Khoảng đệm lớn hơn sẽ khiến ảnh quá lớn để xuất. | Shown when some padding sizes are unavailable (RULE-14) |
| **COPY-crop.size** | {width} × {height} px | {width} × {height} px | |

## Redaction
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-redact.kind** | Redaction type | Kiểu che | |
| **COPY-redact.solid** | Solid (secure) | Khối đặc (an toàn) | |
| **COPY-redact.blur** | Blur | Làm mờ | |
| **COPY-redact.pixelate** | Pixelate | Làm vỡ điểm ảnh | |
| **COPY-redact.not_secure** | Not secure: blurred or pixelated text can sometimes be recovered. | Không an toàn: chữ bị làm mờ hoặc vỡ điểm ảnh đôi khi có thể khôi phục được. | |
| **COPY-redact.use_solid** | Use solid | Dùng khối đặc | Switches the selection, or else the tool's current kind, to solid |
| **COPY-redact.not_secure_short** | Not secure | Không an toàn | Short tag on the blur and pixelate choices (RULE-10) |

## Loading
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-load.empty_title** | Paste, drop or open an image | Dán, thả hoặc mở một ảnh | |
| **COPY-load.empty_hint** | Press {paste_key} to paste a screenshot, drop an image file here, or choose Open image. | Nhấn {paste_key} để dán ảnh chụp màn hình, thả tệp ảnh vào đây, hoặc chọn Mở ảnh. | {paste_key}: Ctrl+V or ⌘V |
| **COPY-load.drop_here** | Drop to open | Thả để mở | |
| **COPY-load.click_to_paste** | Click here, then press {paste_key} to paste, or choose Open image. | Nhấp vào đây, rồi nhấn {paste_key} để dán, hoặc chọn Mở ảnh. | Shown when embedded and the tool has no focus |
| **COPY-load.loading** | Opening image… | Đang mở ảnh… | |
| **COPY-load.no_image_in_clipboard** | The clipboard has no image. | Bộ nhớ tạm không có ảnh. | |
| **COPY-load.first_only** | Opened the first image only. | Chỉ mở ảnh đầu tiên. | |
| **COPY-load.scale_down_title** | This image is very large | Ảnh này rất lớn | |
| **COPY-load.scale_down** | Open it scaled down to {width} × {height} px? The original file is not changed. | Mở ảnh thu nhỏ còn {width} × {height} px? Tệp gốc không bị thay đổi. | |
| **COPY-load.scale_down_action** | Open scaled down | Mở bản thu nhỏ | |

## Confirmations
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-confirm.replace_title** | Replace this image? | Thay ảnh này? | |
| **COPY-confirm.replace** | Your changes haven't been copied or downloaded. They will be lost. | Các thay đổi của bạn chưa được sao chép hoặc tải xuống và sẽ bị mất. | |
| **COPY-confirm.clear_title** | Start over? | Bắt đầu lại? | |
| **COPY-confirm.clear** | Your changes haven't been copied or downloaded. They will be lost, and this can't be undone. | Các thay đổi của bạn chưa được sao chép hoặc tải xuống và sẽ bị mất. Không thể hoàn tác. | |

## Export
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-export.preparing** | Preparing image… | Đang chuẩn bị ảnh… | |
| **COPY-export.copied** | Copied to clipboard. | Đã sao chép vào bộ nhớ tạm. | Used when the redaction count is 0 |
| **COPY-export.copied_redactions** | one: Copied, with {count} redaction applied. · other: Copied, with {count} redactions applied. | Đã sao chép, đã áp dụng {count} vùng che. | Used when the count (RULE-20) is ≥ 1 |
| **COPY-export.downloaded** | Downloaded {file_name}. | Đã tải xuống {file_name}. | Used when the redaction count is 0 |
| **COPY-export.downloaded_redactions** | one: Downloaded {file_name}, with {count} redaction applied. · other: Downloaded {file_name}, with {count} redactions applied. | Đã tải xuống {file_name}, đã áp dụng {count} vùng che. | Used when the count is ≥ 1 |
| **COPY-export.redaction_count** | one: {count} redaction · other: {count} redactions | {count} vùng che | Live count next to the export actions; hidden at 0 |

## Errors
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-error.unsupported_format** | This file type isn't supported. Use {formats}. | Không hỗ trợ loại tệp này. Hãy dùng {formats}. | {formats}: the RULE-01 formats this browser can decode |
| **COPY-error.export_failed** | The image couldn't be exported. Try again, or crop it smaller. | Không xuất được ảnh. Hãy thử lại hoặc cắt nhỏ hơn. | |
| **COPY-error.decode_failed** | This image couldn't be opened. The file may be damaged. | Không mở được ảnh này. Tệp có thể bị hỏng. | |
| **COPY-error.file_too_large** | This file is larger than {limit}. | Tệp này lớn hơn {limit}. | {limit}: 50 MB |
| **COPY-error.clipboard** | The browser blocked copying the image. Download it instead. | Trình duyệt đã chặn sao chép ảnh. Hãy tải xuống thay thế. | |

## Text
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-text.placeholder** | Type here | Nhập chữ | |

## Position & size
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-geometry.title** | Position and size | Vị trí và kích thước | |
| **COPY-geometry.x** | X | X | |
| **COPY-geometry.y** | Y | Y | |
| **COPY-geometry.width** | Width | Rộng | |
| **COPY-geometry.height** | Height | Cao | |
| **COPY-geometry.start** | Start | Điểm đầu | Line/arrow tail |
| **COPY-geometry.end** | End | Điểm cuối | Line/arrow head |

## App & accessibility
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-app.title** | Image Annotator | Image Annotator | Product name and page title; same in every language |
| **COPY-a11y.canvas** | Image canvas | Vùng ảnh | |
| **COPY-a11y.canvas_summary** | one: {width} × {height} px canvas, {count} annotation · other: {width} × {height} px canvas, {count} annotations | Khung ảnh {width} × {height} px, {count} chú thích | Description of the canvas region |
| **COPY-a11y.annotation** | {kind} at {x}, {y} | {kind} tại {x}, {y} | {kind}: the tool name, or the redaction kind name |
| **COPY-a11y.step_annotation** | Step {number} at {x}, {y} | Bước {number} tại {x}, {y} | Used instead of COPY-a11y.annotation for steps (RULE-07) |
| **COPY-a11y.text_annotation** | Text “{text}” at {x}, {y} | Chữ “{text}” tại {x}, {y} | Used instead of COPY-a11y.annotation for text annotations |
| **COPY-a11y.tool_active** | {tool} tool | Công cụ {tool} | |
| **COPY-a11y.loaded** | Image opened, {width} × {height} px | Đã mở ảnh, {width} × {height} px | Announced when an image loads |
| **COPY-a11y.cleared** | Image cleared. Open, paste or drop an image to start | Đã xoá ảnh. Mở, dán hoặc thả ảnh để bắt đầu | Announced after starting over (F-014.R3) |
| **COPY-a11y.annotations_list** | Annotations | Chú thích | Name of the list of annotations inside the canvas |
| **COPY-a11y.annotations_hint** | Tab moves to the next annotation; arrow keys move the selected one. | Tab để chuyển sang chú thích tiếp theo; phím mũi tên di chuyển chú thích đang chọn. | Description of the annotations list |
| **COPY-a11y.placed** | {kind} added | Đã thêm {kind} | |
| **COPY-a11y.undone** | Undone | Đã hoàn tác | |
| **COPY-a11y.redone** | Redone | Đã làm lại | |
| **COPY-a11y.deleted_count** | one: {count} annotation deleted · other: {count} annotations deleted | Đã xoá {count} chú thích | |
| **COPY-a11y.duplicated_count** | one: {count} annotation duplicated · other: {count} annotations duplicated | Đã nhân bản {count} chú thích | |
| **COPY-a11y.selected_count** | one: {count} annotation selected · other: {count} annotations selected | Đã chọn {count} chú thích | |
| **COPY-a11y.toolbar** | Tools and actions | Công cụ và thao tác | Name of the toolbar |
| **COPY-a11y.tool_group** | Drawing tools | Công cụ vẽ | Name of the single-choice tool group |
| **COPY-a11y.style_panel** | Style | Kiểu dáng | Name of the style panel |
| **COPY-a11y.zoom_menu** | Zoom: {percent} % | Thu phóng: {percent} % | Name of the narrow zoom button |
| **COPY-a11y.new_tab** | (opens in a new tab) | (mở trong thẻ mới) | Appended to links that open a new tab |

## Status & privacy
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-status.zoom** | {percent} % | {percent} % | |
| **COPY-status.zoom_none** | – | – | Zoom level shown when no image is loaded |
| **COPY-status.image_size** | {width} × {height} px | {width} × {height} px | |
| **COPY-privacy.badge** | Runs locally, nothing uploaded | Chạy trên máy, không tải lên | |
| **COPY-privacy.badge_label** | Privacy: runs locally, nothing uploaded | Quyền riêng tư: chạy trên máy, không tải lên | Icon-only accessible name |
| **COPY-privacy.details** | Your images are opened and edited only in this browser. Nothing you add is uploaded, stored or tracked. To work offline, the tool keeps a copy of its own files in this browser; it makes no other network requests. Exported images contain no metadata from the original. Blur and pixelate can sometimes be reversed; use solid redaction for secrets. | Ảnh của bạn chỉ được mở và chỉnh sửa trong trình duyệt này. Không có gì bạn thêm vào được tải lên, lưu lại hay theo dõi. Để dùng được khi không có mạng, công cụ giữ một bản sao các tệp của chính nó trong trình duyệt này; ngoài ra không gửi yêu cầu mạng nào khác. Ảnh xuất ra không chứa siêu dữ liệu của ảnh gốc. Làm mờ và vỡ điểm ảnh đôi khi có thể đảo ngược; hãy dùng khối đặc cho thông tin bí mật. | |
| **COPY-privacy.source_label** | Source code on GitHub | Mã nguồn trên GitHub | |
| **COPY-privacy.notices** | Open-source notices | Thông báo mã nguồn mở | |
| **COPY-privacy.title** | Privacy | Quyền riêng tư | Name of the privacy details |

## Shortcuts help
| ID | en-US | vi-VN | Notes |
|---|---|---|---|
| **COPY-shortcuts.title** | Keyboard shortcuts | Phím tắt | |
| **COPY-shortcuts.tools** | Tools | Công cụ | |
| **COPY-shortcuts.edit** | Edit | Chỉnh sửa | |
| **COPY-shortcuts.view** | View | Xem | |
| **COPY-shortcuts.export** | Export | Xuất ảnh | |
| **COPY-shortcuts.history** | History | Lịch sử | |
| **COPY-shortcuts.canvas** | Canvas | Vùng ảnh | |
| **COPY-shortcuts.load** | Open | Mở | |
| **COPY-shortcuts.help** | Help | Trợ giúp | |
| **COPY-shortcuts.pointer** | Pointer | Con trỏ | |
| **COPY-shortcuts.scope_note** | Single-key and editing shortcuts work while the image has focus. | Phím tắt một phím và phím chỉnh sửa hoạt động khi vùng ảnh đang được chọn. | RULE-19 scope |
| **COPY-key.drag** | drag | kéo | Pointer action in a key cell (Space+drag, Alt+drag) |
| **COPY-key.wheel** | wheel | con lăn | Pointer action in a key cell (Ctrl+wheel) |
| **COPY-key.or** | or | hoặc | Joins aliases in spoken key names |
| **COPY-key.spoken_arrows** | Left, Up, Right or Down arrow | mũi tên trái, lên, phải hoặc xuống | Spoken name of the arrow keys |
| **COPY-key.spoken_plus** | plus | dấu cộng | Spoken name of + |
| **COPY-key.spoken_minus** | minus | dấu trừ | Spoken name of − |
| **COPY-key.spoken_equals** | equals | dấu bằng | Spoken name of = |
| **COPY-key.spoken_question** | question mark | dấu chấm hỏi | Spoken name of ? |
| **COPY-shortcut.place** | Place an annotation | Đặt chú thích | |
| **COPY-shortcut.next** | Next / previous annotation | Chú thích tiếp theo / trước | |
| **COPY-shortcut.select_all** | Select all | Chọn tất cả | |
| **COPY-shortcut.cancel** | Cancel, finish editing, deselect | Huỷ, xong chỉnh sửa, bỏ chọn | |
| **COPY-shortcut.edit_text** | Edit selected text | Sửa chữ đang chọn | |
| **COPY-shortcut.zoom_pointer** | Zoom at pointer | Thu phóng tại con trỏ | |
| **COPY-shortcut.move** | Move selection | Di chuyển vùng chọn | |
| **COPY-shortcut.resize** | Resize selection | Đổi kích thước vùng chọn | |
| **COPY-shortcut.pan** | Pan the view | Kéo khung nhìn | |
| **COPY-shortcut.move_while_drawing** | Move while drawing | Di chuyển khi đang vẽ | |
| **COPY-shortcut.paste** | Paste an image | Dán ảnh | |
