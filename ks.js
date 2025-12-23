// ==UserScript==
// @name         知行实验室答题助手
// @namespace    http://tampermonkey.net/
// @version      2.2.2
// @description  一键秒杀 mhlabs.cloudrange.cn 上的幻灯片与考试题目
// @author       LEN5010
// @match        *://mhlabs.cloudrange.cn/*
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        bgImage: 'len5010.github.io/img/fll2.jpg',
        title: '知行实验室答题助手'
    };

    if (window.self === window.top) {
        initCustomStyle();
        initUI();
    }

    window.addEventListener('message', function(event) {
        if (event.data && event.data.action === 'CR_HACK_SLIDES') {
            console.log("[Frame] 收到幻灯片破解指令...");
            runSlideSolver();
        }
        if (event.data && event.data.action === 'CR_HACK_EXAM') {
            console.log("[Frame] 收到考试破解指令...");
            runExamSolver();
        }
    });

    function initCustomStyle() {
        const css = `
            #cr-hack-panel {
                position: fixed;
                top: 100px;
                right: 100px;
                width: 240px;
                z-index: 999999;
                background-color: #0d0000;
                background-image: ${CONFIG.bgImage ? `url("${CONFIG.bgImage}")` : 'none'};
                background-size: cover;
                background-position: center;
                border: 1px solid #4a0000;
                border-radius: 0; 
                box-shadow: 0 5px 15px rgba(0,0,0,0.6);
                font-family: "Microsoft YaHei", sans-serif;
                height: auto;
            }
            #cr-panel-overlay {
                background: rgba(0, 0, 0, 0.3); 
                padding: 10px;
                display: flex;
                flex-direction: column;
            }
            #cr-header {
                margin: -10px -10px 12px -10px;
                padding: 8px;
                background: rgba(40, 0, 0, 0.8);
                color: #cc9999;
                font-size: 13px;
                font-weight: bold;
                text-align: center;
                cursor: move;
                border-bottom: 1px solid #5c0000;
                user-select: none;
                letter-spacing: 1px;
            }
            .cr-btn {
                display: block;
                width: 130px;
                margin: 0 auto 8px auto;
                padding: 7px 0;
                border: 1px solid #5c0000;
                border-radius: 0;
                background: rgba(60, 10, 10, 0.85); 
                color: #dcb4b4;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-align: center;
                backdrop-filter: blur(2px);
            }
            .cr-btn:hover {
                background: rgba(100, 20, 20, 0.95);
                border-color: #8a0a0a;
                color: #fff;
            }
            #cr-status {
                margin-top: 4px;
                font-size: 11px;
                color: rgba(255, 200, 200, 0.5);
                text-align: center;
            }
            .status-active {
                color: #ff3333 !important;
            }
        `;

        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(css);
        } else {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
        }
    }

    function initUI() {
        const div = document.createElement('div');
        div.id = 'cr-hack-panel';
        div.innerHTML = `
            <div id="cr-panel-overlay">
                <div id="cr-header">${CONFIG.title}</div>
                <button id="btn-slides" class="cr-btn">解决幻灯片</button>
                <button id="btn-exam" class="cr-btn">解决考试题</button>
                <div id="cr-status">喜欢的话给我点个star吧:github.com/LEN5010/ZLA</div>
            </div>
        `;
        document.body.appendChild(div);

        const header = document.getElementById('cr-header');
        const panel = document.getElementById('cr-hack-panel');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            
            panel.style.right = 'auto';
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';
            
            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.left = `${initialLeft + dx}px`;
            panel.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });

        document.getElementById('btn-slides').onclick = () => {
            updateStatus("正在广播幻灯片指令...", true);
            broadcastMessage('CR_HACK_SLIDES');
            runSlideSolver();
        };

        document.getElementById('btn-exam').onclick = () => {
            updateStatus("正在运行考试破解...", true);
            broadcastMessage('CR_HACK_EXAM');
            runExamSolver();
        };
    }

    function updateStatus(text, active = false) {
        const el = document.getElementById('cr-status');
        if (el) {
            el.innerText = text;
            if (active) el.classList.add('status-active');
            else el.classList.remove('status-active');
        }
    }

    function broadcastMessage(action) {
        const frames = document.getElementsByTagName('iframe');
        for (let i = 0; i < frames.length; i++) {
            try {
                frames[i].contentWindow.postMessage({ action: action }, '*');
            } catch (e) {}
        }
    }

    async function runSlideSolver() {
        console.log("[Slide] 开始搜索...");
        
        function isStoryData(obj) {
            if (!obj || typeof obj !== 'object') return false;
            if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) return false;
            let firstScene = obj.scenes[0];
            if (!firstScene || !Array.isArray(firstScene.slides)) return false;
            return !!(firstScene.id && firstScene.slides[0].id);
        }

        let targetData = null;
        const blacklist = ['window', 'document', 'top', 'parent', 'frames', 'self', 'location', 'history', 'navigator'];

        for (let key in window) {
            if (blacklist.includes(key)) continue;
            try { if (isStoryData(window[key])) { targetData = window[key]; break; } } catch (e) {}
        }

        if (!targetData) {
            let namespaces = ['story', 'DS', 'public_story', 'player', 'g_oContentResults'];
            for (let ns of namespaces) {
                if (window[ns]) {
                    if (isStoryData(window[ns])) { targetData = window[ns]; break; }
                    for (let key in window[ns]) {
                        try { if (isStoryData(window[ns][key])) { targetData = window[ns][key]; break; } } catch(e){}
                    }
                }
                if (targetData) break;
            }
        }

        if (!targetData) {
            if (typeof window.Script1 === 'function') {
                try { window.Script1(); updateStatus("已尝试直接结束(Script1)"); } catch(e) {}
            }
            return;
        }

        updateStatus("找到数据，开始秒刷...", true);
        var allIds = [];
        targetData.scenes.forEach(scene => {
            scene.slides.forEach(slide => {
                allIds.push(scene.id + "." + slide.id);
            });
        });

        function getCookie(name) {
            var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            if (match) return unescape(match[2]);
            return "";
        }
        var token = getCookie('XSRF-TOKEN');

        for (let i = 0; i < allIds.length; i++) {
            let id = allIds[i];
            let xhr = new XMLHttpRequest();
            xhr.open("POST", "callback/viewPage", true);
            if (token) xhr.setRequestHeader('X-XSRF-TOKEN', token);
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xhr.send("pageId=" + id);
            await new Promise(r => setTimeout(r, 20));
        }

        var xhrEnd = new XMLHttpRequest();
        xhrEnd.open("POST", "callback/viewEnd", true);
        if (token) xhrEnd.setRequestHeader('X-XSRF-TOKEN', token);
        xhrEnd.send("");

        try { if(window.Script1) window.Script1(); } catch(e){}
        updateStatus("幻灯片完成!", true);
        alert(`幻灯片破解完成！共 ${allIds.length} 页。`);
    }

    async function runExamSolver() {
        function findComponent() {
            let root = document.getElementById('app') || document.querySelector('body > div');
            if (!root || !root.__vue__) return null;
            function traverse(vueInstance) {
                if (vueInstance.answerRecord) return vueInstance;
                for (let child of vueInstance.$children) {
                    let found = traverse(child);
                    if (found) return found;
                }
                return null;
            }
            return traverse(root.__vue__);
        }

        const sleep = (min, max) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1) + min)));

        var target = findComponent();
        if (!target) {
            alert("未找到考试组件，请确保进入了答题页面！");
            return;
        }

        updateStatus("正在分析题目数据...", true);
        var details = target.answerRecord.details;
        var trainRecordId = target.trainRecordId;

        function getCombinations(options) {
            var result = [];
            var f = function(prefix, options) {
                for (var i = 0; i < options.length; i++) {
                    result.push(prefix.concat(options[i]));
                    f(prefix.concat(options[i]), options.slice(i + 1));
                }
            }
            f([], options);
            return result.sort((a, b) => a.length - b.length);
        }

        for (let i = 0; i < details.length; i++) {
            let item = details[i];
            if (item.answerFlag === '0') continue;

            updateStatus(`正在破解第 ${i+1}/${details.length} 题...`, true);
            let qType = item.question.choiceType;

            if (qType === "2") {
                if (item.answerFlag !== '0') {
                    item.answerOptionIds = "1";
                    try { 
                        await target.submitQuestion(item, false); 
                        target.typeover = false; 
                    } catch(e) {}
                    await sleep(500, 800);
                }

                let realAnswer = null;
                try {
                    let res = await target.$api.train.act.getQuestionPaper({ trainRecordId: trainRecordId });
                    if (res && res.data && res.data.details) {
                        let freshQuestion = res.data.details.find(d => d.id === item.id);
                        if (freshQuestion && freshQuestion.question) {
                            realAnswer = freshQuestion.question.questionAnswer;
                        }
                    }
                } catch(e) {}

                if (realAnswer) {
                    item.answerOptionIds = realAnswer;
                    try { 
                        await target.submitQuestion(item, false); 
                        target.typeover = false; 
                    } catch(e) {}
                    await sleep(300, 500);
                }
                continue;
            }

            if (!item.options || item.options.length === 0) continue;

            let combinations = [];
            if (qType === "1") {
                let combos = getCombinations(item.options);
                combinations = combos.map(combo => ({ ids: combo.map(opt => opt.id) }));
            } else {
                combinations = item.options.map(opt => ({ ids: opt.id }));
            }

            for (let attempt of combinations) {
                item.answerOptionIds = attempt.ids;
                try { 
                    await target.submitQuestion(item, false); 
                    target.typeover = false; 
                } catch (e) {
                    await sleep(500, 1000);
                }
                
                await sleep(200, 400); 

                if (item.answerFlag === '0') break;
            }
            await sleep(100, 200);
        }

        try { target.calculateTypeover(); } catch(e){}
        updateStatus("考试破解完成", true);
        
        let leftCount = details.filter(d => d.answerFlag !== '0').length;
        if (leftCount > 0) {
            alert(`破解完成，但仍有 ${leftCount} 道题未正确，请再次点击按钮补漏。`);
        } else {
            alert("所有题目破解完成！");
        }
    }

})();
