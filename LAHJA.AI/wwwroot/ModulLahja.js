
   
        // العناصر الرئيسية
        const popupOpener = document.getElementById('popupOpener');
        const voicePopup = document.getElementById('voicePopup');
        const closeBtn = document.getElementById('closeBtn');
        const minimizeBtn = document.getElementById('minimizeBtn');
        // const themeToggle = document.getElementById('themeToggle');
        const micCircle = document.getElementById('micCircle');
        const status = document.getElementById('status');
        const wave = document.getElementById('wave');
        const browserWarning = document.getElementById('browserWarning');
        const permissionNotice = document.getElementById('permissionNotice');
        const permissionIndicator = document.getElementById('permissionIndicator');
        const startSessionBtn = document.getElementById('startSessionBtn');
        const stopSessionBtn = document.getElementById('stopSessionBtn');
        const sessionIndicator = document.getElementById('sessionIndicator');

        // المتغيرات العامة
        let isPopupOpen = false;
        let isNightMode = false;
        let isConversationActive = false;
        let isSessionActive = false;
        let currentAudio = null;
        let hasMicrophonePermission = false;
        let recognition = null;

        // تهيئة النظام
        function initSystem() {
            loadSettings();
            initEventListeners();
            checkBrowserSupport();

            setTimeout(() => {
                checkMicrophonePermission();
            }, 1000);
        }

        // تحميل الإعدادات
        function loadSettings() {
            const savedNightMode = localStorage.getItem('popupNightMode') === 'true';
            if (savedNightMode) {
                toggleNightMode();
            }
        }

        // إعداد مستمعي الأحداث
        function initEventListeners() {
            // فتح/إغلاق النافذة
            popupOpener.addEventListener('click', togglePopup);
            closeBtn.addEventListener('click', closePopup);
            minimizeBtn.addEventListener('click', minimizePopup);

            // تبديل الوضع الليلي
            // themeToggle.addEventListener('click', toggleNightMode);

            // أزرار الجلسة
            startSessionBtn.addEventListener('click', startSession);
            stopSessionBtn.addEventListener('click', stopSession);

            // النقر على الميكروفون
            micCircle.addEventListener('click', handleMicClick);
        }

        // التحقق من دعم المتصفح
        function checkBrowserSupport() {
            if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
                status.textContent = "المتصفح غير مدعوم";
                browserWarning.style.display = 'block';
                return false;
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                status.textContent = "لا يدعم الميكروفون";
                browserWarning.style.display = 'block';
                return false;
            }

            return true;
        }

        // التحقق من إذن الميكروفون
        async function checkMicrophonePermission() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                status.textContent = "جاهز للتحدث";
                permissionNotice.style.display = 'none';
                hasMicrophonePermission = true;
                permissionIndicator.classList.add('granted');
                
                stream.getTracks().forEach(track => track.stop());
                return true;
            } catch (error) {
                status.textContent = "انقر للسماح بالميكروفون";
                permissionNotice.style.display = 'block';
                hasMicrophonePermission = false;
                permissionIndicator.classList.remove('granted');
                return false;
            }
        }

        // تهيئة نظام التعرف على الصوت
        function initSpeechRecognition() {
            if (!checkBrowserSupport()) return null;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'ar-SA';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = handleRecognitionStart;
            recognition.onresult = handleRecognitionResult;
            recognition.onend = handleRecognitionEnd;
            recognition.onerror = handleRecognitionError;

            return recognition;
        }

        // معالجة التعرف على الصوت
        function handleRecognitionStart() {
            setListeningUI();
        }

        async function handleRecognitionResult(event) {
            const transcript = event.results[0][0].transcript;
            status.textContent = `تم: "${transcript}"`;
            micCircle.classList.remove('listening');

            try {
                const reply = await getGPTResponse(transcript);
                await speakResponse(reply);
            } catch (error) {
                console.error('Error:', error);
                setIdleUI("حدث خطأ");
                isConversationActive = false;
            }
        }

        function handleRecognitionEnd() {
            if (!isConversationActive) {
                setIdleUI("انقر للتحدث");
            }
        }

        function handleRecognitionError(event) {
            console.error('خطأ:', event.error);
            
            if (event.error === 'no-speech' && isConversationActive) {
                try {
                    recognition.start();
                } catch (e) {
                    setIdleUI("حاول مرة أخرى");
                    isConversationActive = false;
                }
            } else {
                setIdleUI("خطأ: " + event.error);
                isConversationActive = false;
            }
        }

        // التحكم في الواجهة
        function setIdleUI(message = "انقر للتحدث") {
            status.textContent = message;
            micCircle.classList.remove('listening', 'speaking');
            wave.classList.add('hidden');
        }

        function setListeningUI() {
            status.textContent = "أستمع إليك...";
            micCircle.classList.remove('speaking');
            micCircle.classList.add('listening');
            wave.classList.remove('hidden');
        }

        function setSpeakingUI() {
            status.textContent = "جاري الرد...";
            micCircle.classList.remove('listening');
            micCircle.classList.add('speaking');
        }

        // دوال المساعد
        async function speakResponse(text) {
            setSpeakingUI();

            try {
                const response = await fetch("https://lahja-dev-resource.cognitiveservices.azure.com/openai/deployments/LAHJA-V1/audio/speech?api-version=2025-03-01-preview", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer 4AwsIf87cyBIgaJVsy0phWUQdZFcbrJxpQBDQNzL4xjcP2MFzrrYJQQJ99BIACHYHv6XJ3w3AAAAACOGYrzM"
                    },
                    body: JSON.stringify({
                        model: "LAHJA-V1",
                        input: text,
                        voice: "alloy",
                        speed: 0.75
                    })
                });

                if (!response.ok) throw new Error(`TTS error: ${response.status}`);

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                currentAudio = new Audio(audioUrl);

                currentAudio.play().catch(e => {
                    console.error('Play error:', e);
                    setIdleUI("خطأ في الصوت");
                    isConversationActive = false;
                });

                currentAudio.onended = () => {
                    currentAudio = null;
                    isConversationActive = false;
                    setIdleUI("انقر للتحدث");

                    if (isSessionActive) {
                        setTimeout(() => {
                            if (isSessionActive) {
                                startListening();
                            }
                        }, 1000);
                    }
                };

            } catch (error) {
                console.error('Error in speakResponse:', error);
                setIdleUI("خطأ في الصوت");
                isConversationActive = false;
            }
        }

        async function getGPTResponse(text) {
            try {
                status.textContent = 'جاري المعالجة...';

                const response = await fetch("https://lahja-dev-resource.cognitiveservices.azure.com/openai/deployments/Wasm-V1/chat/completions?api-version=2025-01-01-preview", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer 4AwsIf87cyBIgaJVsy0phWUQdZFcbrJxpQBDQNzL4xjcP2MFzrrYJQQJ99BIACHYHv6XJ3w3AAAAACOGYrzM"
                    },
                    body: JSON.stringify({
                        messages: [
                            {
                                "role": "system",
                                "content": "انت نموذج اسمه (لهجة) مطور من قبل شركة أسس الذكاء الرقمي. رد باللهجة النجدية بطريقة ودية وطبيعية في جميع المحادثات."
                            },
                            {
                                "role": "system",
                                "content": "دائما اجابتك تكون باللهجة النجدية  ودائما   اجابتك تكون مختصره جدا لا  تتجاوز سطر "
                            },
                            {
                                "role": "user",
                                "content": text
                            }
                        ],
                        max_tokens: 4096,
                        temperature: 0.75,
                        top_p: 1,
                        model: "Wasm-V1"
                    })
                });

                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

                const data = await response.json();
                return data.choices[0].message.content;

            } catch (error) {
                console.error('Error getting GPT response:', error);
                return "الله يوفقك يا طيب! حاول مرة ثانية وخذ راحتك بالكلام.";
            }
        }

        // إدارة الجلسة
        function startSession() {
            if (!isSessionActive) {
                isSessionActive = true;
                startSessionBtn.classList.add('active');
                stopSessionBtn.classList.remove('active');
                sessionIndicator.classList.add('active');
                status.textContent = "الجلسة نشطة";

                startListening();
            }
        }

        function stopSession() {
            if (isSessionActive) {
                isSessionActive = false;
                startSessionBtn.classList.remove('active');
                stopSessionBtn.classList.add('active');
                sessionIndicator.classList.remove('active');
                status.textContent = "تم إيقاف الجلسة";

                if (recognition) {
                    recognition.stop();
                }
                if (currentAudio) {
                    currentAudio.pause();
                }
                isConversationActive = false;
                setIdleUI("تم إيقاف الجلسة");
            }
        }

        function startListening() {
            if (!isConversationActive && isSessionActive) {
                if (!hasMicrophonePermission) {
                    checkMicrophonePermission().then(hasPermission => {
                        if (hasPermission && isSessionActive) {
                            actuallyStartListening();
                        }
                    });
                } else {
                    actuallyStartListening();
                }
            }
        }

        function actuallyStartListening() {
            if (!recognition) {
                recognition = initSpeechRecognition();
                if (!recognition) return;
            }

            isConversationActive = true;
            try {
                recognition.start();
            } catch (e) {
                console.error("خطأ في البدء:", e);
                setIdleUI("حدث خطأ");
                isConversationActive = false;
            }
        }

        // النقر على الميكروفون
        async function handleMicClick() {
            if (!isConversationActive && !isSessionActive) {
                if (!hasMicrophonePermission) {
                    hasMicrophonePermission = await checkMicrophonePermission();
                    if (!hasMicrophonePermission) {
                        status.textContent = "انقر مرة أخرى بعد السماح";
                        return;
                    }
                }

                if (!recognition) {
                    recognition = initSpeechRecognition();
                    if (!recognition) return;
                }

                isConversationActive = true;
                try {
                    recognition.start();
                } catch (e) {
                    console.error("خطأ في البدء:", e);
                    setIdleUI("حدث خطأ");
                    isConversationActive = false;
                }
            } else if (!isSessionActive) {
                isConversationActive = false;
                if (recognition) {
                    recognition.stop();
                }
                if (currentAudio) {
                    currentAudio.pause();
                }
                setIdleUI("تم الإيقاف");
            }
        }

        // التحكم في النافذة
        function togglePopup() {
            isPopupOpen = !isPopupOpen;
            voicePopup.classList.toggle('active', isPopupOpen);
        }

        function closePopup() {
            isPopupOpen = false;
            voicePopup.classList.remove('active');
            stopSession();
        }

        function minimizePopup() {
            isPopupOpen = false;
            voicePopup.classList.remove('active');
        }

        function toggleNightMode() {
            isNightMode = !isNightMode;
            voicePopup.classList.toggle('night-mode', isNightMode);
            themeToggle.textContent = isNightMode ? '☀️' : '🌙';
            localStorage.setItem('popupNightMode', isNightMode.toString());
        }

        // بدء التشغيل
        document.addEventListener('DOMContentLoaded', initSystem);

        // إغلاق النافذة بالنقر خارجها
        document.addEventListener('click', (e) => {
            if (isPopupOpen && 
                !voicePopup.contains(e.target) && 
                !popupOpener.contains(e.target)) {
                closePopup();
            }
        });
        