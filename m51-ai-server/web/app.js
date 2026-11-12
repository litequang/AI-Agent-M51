const messagesEl = document.querySelector('#messages');
const welcome = document.querySelector('#welcome');
const input = document.querySelector('#prompt');
const send = document.querySelector('#send');
const thinking = document.querySelector('#thinking');
const modelSelect = document.querySelector('#model');
const newChat = document.querySelector('#new-chat');
let history = [], controller = null, modelsLoaded = false;

const sample = 'Hội thoại GIẢ LẬP:\nLan: Minh gửi báo giá cho khách An trước 15:00 hôm nay nhé.\nMinh: Tôi nhận việc gửi báo giá trước 15:00 hôm nay.\nAn: KHẨN CẤP! Máy in đang bốc khói. Ngắt điện ngay và gọi người phụ trách an toàn!\nLan: Ưu tiên xử lý nguy cơ cháy trước.';

async function loadModels() {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) throw Error();
    const data = await response.json();
    if (!data.models.length) throw Error();
    let saved;
    try { saved = localStorage.getItem('m51-model'); } catch {}
    modelSelect.replaceChildren(...data.models.map(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      return option;
    }));
    modelSelect.value = data.models.some(model => model.id === saved) ? saved : data.default;
    modelSelect.disabled = false;
    modelsLoaded = true;
  } catch {
    modelSelect.options[0].textContent = 'Chưa tải được model';
  }
}

modelSelect.addEventListener('change', () => {
  try { localStorage.setItem('m51-model', modelSelect.value); } catch {}
});

function message(role, text) {
  welcome.hidden = true;
  const row = document.createElement('div');
  row.className = 'message ' + role;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '✳';
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = text;
  row.append(avatar, body);
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return {row, body};
}

async function status() {
  if (!modelsLoaded) await loadModels();
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    document.querySelector('#status-dot').classList.toggle('online', data.ready);
    document.querySelector('#status-text').textContent = data.ready ? 'Sẵn sàng' : 'Đang kết nối lại';
  } catch {
    document.querySelector('#status-text').textContent = 'Chưa kết nối';
  }
}

async function submit() {
  if (controller) { controller.abort(); return; }
  const text = input.value.trim();
  if (!text || !modelsLoaded) return;
  const chosenModel = modelSelect.value;
  const chosenName = modelSelect.selectedOptions[0].textContent;
  modelSelect.disabled = true;
  newChat.disabled = true;
  input.value = '';
  input.style.height = 'auto';
  history.push({role: 'user', content: text});
  message('user', text);
  const reply = message('assistant', 'Đang nạp / xử lý với ' + chosenName + '…');
  reply.body.dataset.model = chosenName;
  reply.row.classList.add('pending');
  controller = new AbortController();
  send.textContent = '■';
  send.setAttribute('aria-label', 'Dừng phản hồi');
  let content = '', completed = false;
  try {
    const response = await fetch('/api/chat', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({model: chosenModel, messages: history, thinking: thinking.checked}),
      signal: controller.signal
    });
    if (!response.ok) {
      const data = await response.json();
      throw Error(data.error || 'Không thể gửi tin nhắn.');
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, {stream: true});
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { completed = true; continue; }
        const chunk = JSON.parse(data);
        if (chunk.error) throw Error('Model gặp lỗi khi phản hồi. Bạn thử lại nhé.');
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.reasoning_content && !content) reply.body.textContent = 'Đang phân tích kỹ nội dung…';
        if (delta?.content) {
          content += delta.content;
          reply.body.textContent = content;
          reply.row.classList.remove('pending');
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }
    }
    if (!content) throw Error('Chưa có phản hồi hoàn chỉnh. Bạn thử câu ngắn hơn hoặc đổi chế độ nhé.');
    if (!completed) throw Error('Kết nối bị ngắt khi đang nhận phản hồi. Bạn thử lại nhé.');
    history.push({role: 'assistant', content});
  } catch (error) {
    if (error.name === 'AbortError' && content) {
      history.push({role: 'assistant', content});
    } else {
      reply.body.textContent = error.name === 'AbortError' ? 'Đã dừng phản hồi.' : error.message;
      if (error.name !== 'AbortError') reply.row.classList.add('error');
      history.pop();
    }
  } finally {
    reply.row.classList.remove('pending');
    controller = null;
    modelSelect.disabled = !modelsLoaded;
    newChat.disabled = false;
    send.textContent = '↑';
    send.setAttribute('aria-label', 'Gửi tin nhắn');
    input.focus();
    status();
  }
}

send.addEventListener('click', submit);
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    submit();
  }
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 145) + 'px';
});
newChat.addEventListener('click', () => {
  if (controller) return;
  history = [];
  messagesEl.querySelectorAll('.message').forEach(element => element.remove());
  welcome.hidden = false;
  input.focus();
});
document.querySelectorAll('.suggestions button').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.sample) {
    thinking.checked = true;
    input.value = sample + '\n\n' + (button.dataset.sample === 'tasks'
      ? 'Chỉ liệt kê công việc đã có người nhận xác nhận, người nhận và hạn chót. Không gán việc chưa ai nhận.'
      : 'Tóm tắt hai câu gồm công việc và sự cố, chỉ ra người nhận việc và hạn chót.');
  } else {
    thinking.checked = false;
    input.value = button.dataset.prompt;
  }
  input.dispatchEvent(new Event('input'));
  input.focus();
}));
status();
setInterval(status, 15000);
