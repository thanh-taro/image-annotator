# Glossary

Use these words in specs, UI copy, code and tests. Avoid the listed alternatives.

| Term | Meaning | Avoid |
|---|---|---|
| Image | The picture the user loaded (ENT-Image). Never changed by the tool. | photo, file (except when talking about the file on disk) |
| Annotation | One editable mark placed on the image (ENT-Annotation): a shape, text, step, highlight, stroke or redaction. | object, layer, element |
| Tool | The kind of annotation the next drag or click creates, or the select tool. | mode, brush |
| Shape | Rectangle, ellipse, line or arrow annotation. | figure |
| Stroke | A freehand pen annotation. Also the line width of a shape ("stroke width"). | path, scribble |
| Highlight | A translucent freehand marker annotation. | marker (in UI copy) |
| Custom colour | An annotation colour outside the palette, chosen in the browser's colour picker through the custom swatch (RULE-21). | other colour |
| Custom size | A size in whole image pixels instead of S, M or L (RULE-21). | free size |
| Custom swatch | The ninth colour choice that applies and picks a custom colour (F-019). | colour button |
| Fill colour | The colour inside a filled rectangle or ellipse; automatic (the annotation's colour) until one is picked (RULE-22). | inner colour |
| Text background | The box with rounded corners behind a text, with its own colour (RULE-22). | label box, highlight box |
| Step | A numbered badge annotation (1, 2, 3…). | counter, bullet |
| Redaction | An annotation that hides part of the image. Kinds: *solid* (secure), *blur*, *pixelate* (not secure). | censor, mask |
| Style | Colour, stroke width and other appearance values of an annotation (ENT-Style). | properties |
| Current style | The style the next new annotation gets. | default style |
| Selection | The annotations currently selected for editing. | |
| Frame | The rectangle of the image that is exported; set by crop (ENT-Frame); padding goes around it. Not the host frame. | crop box, viewport |
| Padding | Space added around the frame, filled with a background (ENT-Padding). | border, margin |
| Canvas | The area that is exported: the frame plus any padding around it. | board, artboard |
| Export | Copying or downloading the flattened result as a new image. | save, render |
| Flattened | Annotations, effects, crop and padding burned into one image with no separate parts. | merged |
| Session | Everything from loading an image until it is replaced, cleared, or the page closes (ENT-Session). | project, document |
| View | Zoom and pan of the canvas on screen; never affects the export. | camera |
| Host | The portal page that embeds the tool. | parent, container |
| Host frame | The area of the host page the tool is embedded in, with the permissions the host grants it. | iframe (outside technical specs) |
