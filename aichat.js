/**
 * draw.io AI Chat Plugin
 *
 * Adds an AI-powered chat sidebar (Google Gemini) that understands the
 * current diagram and can create / edit / delete elements on your behalf.
 *
 * Usage:
 *  1. Host this file somewhere accessible (or use a local server).
 *  2. Open draw.io → Extras → Edit Diagram, then load via:
 *     https://app.diagrams.net/?plugins=1&p=<URL-to-this-file>
 *     Or: Extras > Load Plugin… and paste the URL.
 *  3. Open Extras → AI Chat Assistant.
 *  4. On first use, paste your Gemini API key when prompted.
 *
 * Supported AI operations:
 *  - create_node    – add a new shape
 *  - create_edge    – connect two nodes by label
 *  - delete_element – remove a node or edge by label / id
 *  - update_label   – rename a node or edge
 *  - update_style   – change the visual style of an element
 *  - auto_layout    – rearrange the whole diagram
 */
Draw.loadPlugin(function (ui) {

    /* ------------------------------------------------------------------ */
    /*  Constants                                                           */
    /* ------------------------------------------------------------------ */
    var GEMINI_URL =
        'https://generativelanguage.googleapis.com/v1beta/models/' +
        'gemini-2.0-flash:generateContent';
    var LS_KEY_API  = 'drawio_gemini_api_key';
    var LS_KEY_HIST = 'drawio_ai_chat_history';
    var PANEL_ID    = 'aiChatSidebarPanel';

    /* ------------------------------------------------------------------ */
    /*  State                                                               */
    /* ------------------------------------------------------------------ */
    var chatHistory = [];   // [{role:'user'|'model', parts:[{text}]}]
    var panelOpen   = false;

    /* ------------------------------------------------------------------ */
    /*  Gemini API key helpers                                              */
    /* ------------------------------------------------------------------ */
    function getApiKey() {
        return localStorage.getItem(LS_KEY_API) || '';
    }

    function promptForApiKey() {
        var key = prompt(
            'Enter your Google Gemini API key\n' +
            '(it will be stored only in your browser\'s localStorage):'
        );
        if (key && key.trim()) {
            localStorage.setItem(LS_KEY_API, key.trim());
        }
        return key ? key.trim() : '';
    }

    /* ------------------------------------------------------------------ */
    /*  Graph context serialisation                                         */
    /* ------------------------------------------------------------------ */
    function getGraphContext() {
        var graph = ui.editor.graph;
        var model = graph.model;
        var nodes = [];
        var edges = [];

        for (var id in model.cells) {
            var cell = model.cells[id];
            if (cell.id === '0' || cell.id === '1') continue; // skip root/layer

            var label = model.getValue(cell);
            if (label && typeof label === 'object') {
                label = label.getAttribute ? label.getAttribute('label') : String(label);
            }
            label = label || '';

            if (model.isEdge(cell)) {
                edges.push({
                    id: cell.id,
                    label: label,
                    source: cell.source ? cell.source.id : null,
                    source_label: cell.source ? (model.getValue(cell.source) || '') : '',
                    target: cell.target ? cell.target.id : null,
                    target_label: cell.target ? (model.getValue(cell.target) || '') : ''
                });
            } else if (model.isVertex(cell)) {
                var geo = model.getGeometry(cell);
                nodes.push({
                    id: cell.id,
                    label: label,
                    x: geo ? Math.round(geo.x) : 0,
                    y: geo ? Math.round(geo.y) : 0,
                    width:  geo ? Math.round(geo.width)  : 120,
                    height: geo ? Math.round(geo.height) : 60,
                    style: model.getStyle(cell) || ''
                });
            }
        }

        return { nodes: nodes, edges: edges };
    }

    /* ------------------------------------------------------------------ */
    /*  Command execution                                                   */
    /* ------------------------------------------------------------------ */
    function findCellByLabel(label) {
        var graph = ui.editor.graph;
        var model = graph.model;
        var lower = (label || '').toLowerCase().trim();
        for (var id in model.cells) {
            var cell = model.cells[id];
            var v = model.getValue(cell);
            if (typeof v === 'string' && v.toLowerCase().trim() === lower) return cell;
            if (v && typeof v === 'object') {
                var attr = v.getAttribute ? v.getAttribute('label') : '';
                if ((attr || '').toLowerCase().trim() === lower) return cell;
            }
        }
        return null;
    }

    function findCellById(id) {
        return ui.editor.graph.model.cells[id] || null;
    }

    function executeCommands(commands) {
        if (!commands || !commands.length) return;

        var graph = ui.editor.graph;
        var model = graph.model;

        model.beginUpdate();
        try {
            for (var i = 0; i < commands.length; i++) {
                var cmd = commands[i];

                /* ---- create_node ---- */
                if (cmd.type === 'create_node') {
                    var x = cmd.x != null ? cmd.x : 100 + Math.random() * 400;
                    var y = cmd.y != null ? cmd.y : 100 + Math.random() * 300;
                    var w = cmd.width  || 120;
                    var h = cmd.height || 60;
                    var style = cmd.style || 'rounded=1;whiteSpace=wrap;html=1;';
                    graph.insertVertex(
                        graph.getDefaultParent(),
                        null,
                        cmd.label || 'Node',
                        x, y, w, h,
                        style
                    );
                }

                /* ---- create_edge ---- */
                else if (cmd.type === 'create_edge') {
                    var src = (cmd.source_id && findCellById(cmd.source_id))
                               || findCellByLabel(cmd.source_label);
                    var tgt = (cmd.target_id && findCellById(cmd.target_id))
                               || findCellByLabel(cmd.target_label);
                    if (src && tgt) {
                        var edgeStyle = cmd.style || 'edgeStyle=orthogonalEdgeStyle;';
                        graph.insertEdge(
                            graph.getDefaultParent(),
                            null,
                            cmd.label || '',
                            src, tgt,
                            edgeStyle
                        );
                    } else {
                        appendMessage('system',
                            '⚠️ Could not find nodes to connect: "' +
                            cmd.source_label + '" → "' + cmd.target_label + '"');
                    }
                }

                /* ---- delete_element ---- */
                else if (cmd.type === 'delete_element') {
                    var cell = (cmd.id && findCellById(cmd.id))
                                || findCellByLabel(cmd.label);
                    if (cell) {
                        graph.removeCells([cell]);
                    }
                }

                /* ---- update_label ---- */
                else if (cmd.type === 'update_label') {
                    var cell = (cmd.id && findCellById(cmd.id))
                                || findCellByLabel(cmd.current_label || cmd.label);
                    if (cell) {
                        graph.cellLabelChanged(cell, cmd.new_label || cmd.label, false);
                    }
                }

                /* ---- update_style ---- */
                else if (cmd.type === 'update_style') {
                    var cell = (cmd.id && findCellById(cmd.id))
                                || findCellByLabel(cmd.label);
                    if (cell) {
                        graph.setCellStyles(null, null, [cell]); // reset first
                        model.setStyle(cell, cmd.style || '');
                    }
                }

                /* ---- auto_layout ---- */
                else if (cmd.type === 'auto_layout') {
                    var layoutType = cmd.layout || 'organic';
                    var layout;
                    if (layoutType === 'tree' || layoutType === 'vertical_tree') {
                        layout = new mxCompactTreeLayout(graph, false);
                    } else if (layoutType === 'horizontal_tree') {
                        layout = new mxCompactTreeLayout(graph, true);
                    } else if (layoutType === 'circle') {
                        layout = new mxCircleLayout(graph);
                    } else {
                        layout = new mxOrganicLayout(graph);
                    }
                    layout.execute(graph.getDefaultParent());
                }
            }
        } finally {
            model.endUpdate();
        }

        graph.refresh();
    }

    /* ------------------------------------------------------------------ */
    /*  Gemini API call                                                     */
    /* ------------------------------------------------------------------ */
    var SYSTEM_PROMPT = [
        'You are an AI assistant embedded in the draw.io diagram editor.',
        'The user will describe changes or ask questions about the diagram.',
        'You will receive the current graph as JSON (nodes + edges).',
        '',
        'IMPORTANT: Always respond with valid JSON in this exact format:',
        '{',
        '  "message": "<friendly text to show the user>",',
        '  "commands": [<zero or more command objects>]',
        '}',
        '',
        'Available command types:',
        '  {"type":"create_node","label":"...","x":100,"y":100,"width":120,"height":60,"style":"rounded=1;whiteSpace=wrap;html=1;"}',
        '  {"type":"create_edge","source_label":"...","target_label":"...","label":"","style":"edgeStyle=orthogonalEdgeStyle;"}',
        '  {"type":"delete_element","label":"..."}',
        '  {"type":"update_label","current_label":"...","new_label":"..."}',
        '  {"type":"update_style","label":"...","style":"fillColor=#ff0000;fontColor=#ffffff;strokeColor=#ff0000;"}',
        '  {"type":"auto_layout","layout":"organic|tree|horizontal_tree|circle"}',
        '',
        'Rules:',
        '- Spread new nodes so they do not overlap existing ones.',
        '- For styles use draw.io mxGraph CSS-like key=value; pairs.',
        '- If the user is just asking a question with no diagram changes, return an empty commands array.',
        '- Do NOT wrap the JSON in markdown code blocks.',
        '- If you cannot fulfil a request, set message to an explanation and commands to [].'
    ].join('\n');

    function buildGeminiPayload() {
        var ctx = getGraphContext();
        var contextText =
            'Current diagram JSON:\n' + JSON.stringify(ctx, null, 2);

        var contents = [];

        // Inject graph context as first user turn
        contents.push({
            role: 'user',
            parts: [{ text: contextText }]
        });
        // Dummy model ack
        contents.push({
            role: 'model',
            parts: [{ text: '{"message":"Understood, I have the diagram context.","commands":[]}' }]
        });

        // Append actual conversation history
        for (var i = 0; i < chatHistory.length; i++) {
            contents.push(chatHistory[i]);
        }

        return {
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: contents,
            generationConfig: {
                responseMimeType: 'application/json'
            }
        };
    }

    function callGemini(userMessage, callback) {
        var apiKey = getApiKey();
        if (!apiKey) {
            apiKey = promptForApiKey();
            if (!apiKey) {
                callback(null, 'No API key provided.');
                return;
            }
        }

        // Add user message to history
        chatHistory.push({
            role: 'user',
            parts: [{ text: userMessage }]
        });

        var payload = buildGeminiPayload();
        var url = GEMINI_URL + '?key=' + encodeURIComponent(apiKey);

        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;

            if (xhr.status !== 200) {
                callback(null, 'Gemini API error ' + xhr.status + ': ' + xhr.responseText);
                return;
            }

            try {
                var resp = JSON.parse(xhr.responseText);
                var text = resp.candidates[0].content.parts[0].text;
                var parsed = JSON.parse(text);

                // Add model response to history
                chatHistory.push({
                    role: 'model',
                    parts: [{ text: text }]
                });

                callback(parsed, null);
            } catch (e) {
                callback(null, 'Failed to parse Gemini response: ' + e.message);
            }
        };

        xhr.send(JSON.stringify(payload));
    }

    /* ------------------------------------------------------------------ */
    /*  Chat panel UI                                                       */
    /* ------------------------------------------------------------------ */
    var panelEl     = null;
    var messagesEl  = null;
    var inputEl     = null;
    var sendBtn     = null;
    var statusEl    = null;

    function appendMessage(role, text) {
        if (!messagesEl) return;

        var msg = document.createElement('div');
        msg.style.marginBottom   = '8px';
        msg.style.padding        = '8px 10px';
        msg.style.borderRadius   = '8px';
        msg.style.maxWidth       = '92%';
        msg.style.lineHeight     = '1.4';
        msg.style.fontSize       = '13px';
        msg.style.wordBreak      = 'break-word';
        msg.style.whiteSpace     = 'pre-wrap';

        if (role === 'user') {
            msg.style.background   = '#1a73e8';
            msg.style.color        = '#ffffff';
            msg.style.alignSelf    = 'flex-end';
            msg.style.marginLeft   = 'auto';
        } else if (role === 'assistant') {
            msg.style.background   = '#f1f3f4';
            msg.style.color        = '#202124';
            msg.style.alignSelf    = 'flex-start';
        } else { // system / error
            msg.style.background   = '#fce8e6';
            msg.style.color        = '#c5221f';
            msg.style.alignSelf    = 'flex-start';
        }

        msg.textContent = text;
        messagesEl.appendChild(msg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setLoading(loading) {
        if (!sendBtn || !inputEl) return;
        sendBtn.disabled  = loading;
        inputEl.disabled  = loading;
        statusEl.textContent = loading ? '⏳ Thinking…' : '';
    }

    function handleSend() {
        var text = (inputEl.value || '').trim();
        if (!text) return;

        inputEl.value = '';
        appendMessage('user', text);
        setLoading(true);

        callGemini(text, function (parsed, err) {
            setLoading(false);
            if (err) {
                appendMessage('system', '❌ ' + err);
                return;
            }

            if (parsed.message) {
                appendMessage('assistant', parsed.message);
            }

            if (parsed.commands && parsed.commands.length) {
                try {
                    executeCommands(parsed.commands);
                } catch (execErr) {
                    appendMessage('system', '⚠️ Command error: ' + execErr.message);
                }
            }
        });
    }

    function createPanel() {
        if (panelEl) return;

        /* Outer container */
        panelEl = document.createElement('div');
        panelEl.id = PANEL_ID;

        Object.assign(panelEl.style, {
            position:        'fixed',
            top:             '60px',
            right:           '0',
            width:           '320px',
            height:          'calc(100vh - 60px)',
            background:      '#ffffff',
            borderLeft:      '1px solid #dadce0',
            display:         'flex',
            flexDirection:   'column',
            fontFamily:      'Google Sans, Roboto, Arial, sans-serif',
            zIndex:          '1000',
            boxShadow:       '-2px 0 8px rgba(0,0,0,0.12)'
        });

        /* Header */
        var header = document.createElement('div');
        Object.assign(header.style, {
            padding:      '12px 14px',
            background:   '#1a73e8',
            color:        '#fff',
            fontWeight:   '600',
            fontSize:     '14px',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'space-between',
            flexShrink:   '0'
        });
        header.innerHTML =
            '<span>🤖 AI Diagram Assistant</span>' +
            '<span id="aiChatClose" style="cursor:pointer;font-size:18px;line-height:1;" title="Close">✕</span>';

        /* API key controls */
        var keyBar = document.createElement('div');
        Object.assign(keyBar.style, {
            padding:     '6px 10px',
            background:  '#f8f9fa',
            borderBottom:'1px solid #e0e0e0',
            display:     'flex',
            gap:         '6px',
            flexShrink:  '0'
        });

        var keyLabel = document.createElement('span');
        keyLabel.style.fontSize = '11px';
        keyLabel.style.color    = '#5f6368';
        keyLabel.style.alignSelf = 'center';
        keyLabel.textContent    = getApiKey() ? '🔑 API key set' : '🔑 No key';

        var keyBtn = document.createElement('button');
        keyBtn.textContent = 'Set Key';
        Object.assign(keyBtn.style, {
            fontSize:   '11px',
            padding:    '2px 8px',
            cursor:     'pointer',
            border:     '1px solid #dadce0',
            borderRadius: '4px',
            background: '#fff'
        });
        keyBtn.onclick = function () {
            promptForApiKey();
            keyLabel.textContent = getApiKey() ? '🔑 API key set' : '🔑 No key';
        };

        var clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear chat';
        Object.assign(clearBtn.style, {
            fontSize:   '11px',
            padding:    '2px 8px',
            cursor:     'pointer',
            border:     '1px solid #dadce0',
            borderRadius: '4px',
            background: '#fff',
            marginLeft: 'auto'
        });
        clearBtn.onclick = function () {
            chatHistory = [];
            messagesEl.innerHTML = '';
            appendMessage('assistant',
                'Chat cleared. I still have the current graph context.');
        };

        keyBar.appendChild(keyLabel);
        keyBar.appendChild(keyBtn);
        keyBar.appendChild(clearBtn);

        /* Messages area */
        messagesEl = document.createElement('div');
        Object.assign(messagesEl.style, {
            flex:           '1',
            overflowY:      'auto',
            padding:        '12px 10px',
            display:        'flex',
            flexDirection:  'column',
            gap:            '4px'
        });

        /* Status bar */
        statusEl = document.createElement('div');
        Object.assign(statusEl.style, {
            fontSize:    '11px',
            color:       '#5f6368',
            padding:     '2px 10px',
            minHeight:   '18px',
            flexShrink:  '0'
        });

        /* Input row */
        var inputRow = document.createElement('div');
        Object.assign(inputRow.style, {
            display:      'flex',
            gap:          '6px',
            padding:      '8px 10px',
            borderTop:    '1px solid #e0e0e0',
            flexShrink:   '0'
        });

        inputEl = document.createElement('textarea');
        Object.assign(inputEl.style, {
            flex:        '1',
            resize:      'none',
            height:      '60px',
            fontSize:    '13px',
            padding:     '6px 8px',
            border:      '1px solid #dadce0',
            borderRadius: '8px',
            outline:     'none',
            fontFamily:  'inherit'
        });
        inputEl.placeholder = 'Ask AI to edit the diagram…';
        inputEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        sendBtn = document.createElement('button');
        sendBtn.textContent = 'Send';
        Object.assign(sendBtn.style, {
            padding:      '0 14px',
            background:   '#1a73e8',
            color:        '#fff',
            border:       'none',
            borderRadius: '8px',
            cursor:       'pointer',
            fontSize:     '13px',
            fontWeight:   '600',
            alignSelf:    'flex-end',
            height:       '34px'
        });
        sendBtn.onclick = handleSend;

        inputRow.appendChild(inputEl);
        inputRow.appendChild(sendBtn);

        /* Assemble */
        panelEl.appendChild(header);
        panelEl.appendChild(keyBar);
        panelEl.appendChild(messagesEl);
        panelEl.appendChild(statusEl);
        panelEl.appendChild(inputRow);

        document.body.appendChild(panelEl);

        /* Close button */
        document.getElementById('aiChatClose').onclick = togglePanel;

        /* Welcome message */
        appendMessage('assistant',
            'Hi! I can read your diagram and make changes for you.\n\n' +
            'Examples:\n' +
            '• "Add a node called Database"\n' +
            '• "Connect User to Server"\n' +
            '• "Delete the Cache node"\n' +
            '• "Make the Server node red"\n' +
            '• "Auto-layout the diagram as a tree"');
    }

    function togglePanel() {
        if (!panelEl) {
            createPanel();
            panelOpen = true;
        } else {
            panelOpen = !panelOpen;
            panelEl.style.display = panelOpen ? 'flex' : 'none';
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Menu registration                                                   */
    /* ------------------------------------------------------------------ */
    mxResources.parse('openAIChat=AI Chat Assistant');

    ui.actions.addAction('openAIChat', function () {
        togglePanel();
    });

    var extrasMenu  = ui.menus.get('extras');
    var origExtras  = extrasMenu.funct;

    extrasMenu.funct = function (menu, parent) {
        origExtras.apply(this, arguments);
        ui.menus.addMenuItems(menu, ['-', 'openAIChat'], parent);
    };

});
