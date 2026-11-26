
const API_URL =
"https://script.google.com/macros/s/AKfycbx-IRP47APCuW_EqVtYIxUjwJ1toJhz_lBLjldxQmpAzdDXH9oetwailI2Si5MJV8LeUg/exec";
/****************************************************
 * MENALMEI DELIVERY - INTERFACE
 ****************************************************/

let TOKEN = sessionStorage.getItem('menalmei_token') || '';
let USUARIO = null;
let ENTREGADORES = [];
let intervaloAtualizacao = null;
let TODOS_ENTREGADORES = [];
let categoriaEntregaAtiva = 'aguardando';

const $ = id => document.getElementById(id);


async function chamarServidor(funcao, ...args) {
  try {
    const resposta = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        acao: funcao,
        args: args
      })
    });

    const dados = await resposta.json();

    if (!dados.sucesso) {
      throw new Error(dados.erro || "Erro ao executar operação.");
    }

    return dados.resultado;

  } catch (erro) {
    console.error("Erro na comunicação:", erro);
    throw new Error(
      "Falha ao conectar com o servidor: " + erro.message
    );
  }
}


function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR',{
    style:'currency',
    currency:'BRL'
  });
}

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function aviso(mensagem) {
  alert(mensagem);
}

/* ==========================================
   LOGIN
========================================== */

function criarTelaLogin() {
  document.body.insertAdjacentHTML('afterbegin',`
    <div id="loginScreen">
      <div class="login-card">
        <div class="login-logo">
          MENALMEI <span>DELIVERY</span>
        </div>
        <p>Central de logística</p>

        <form id="loginForm">
          <label>Usuário</label>
          <input id="loginUsuario" autocomplete="username"
                 required placeholder="Seu usuário">

          <label>Senha</label>
          <input id="loginSenha" type="password"
                 autocomplete="current-password"
                 required placeholder="Sua senha">

          <button id="loginButton" type="submit">
            Entrar no sistema
          </button>

          <div id="loginErro"></div>
        </form>
      </div>
    </div>
    <style>
      #loginScreen{
        position:fixed;inset:0;z-index:9999;
        background:#302820;display:flex;
        justify-content:center;align-items:center;
        padding:20px;font-family:Arial,sans-serif
      }
      .login-card{
        background:white;border-radius:18px;
        padding:30px;width:100%;max-width:380px;
        box-shadow:0 15px 50px #0003
      }
      .login-logo{font-size:23px;font-weight:900;color:#302820}
      .login-logo span{color:#765087}
      .login-card p{color:#887f78;margin-bottom:25px}
      .login-card label{
        display:block;font-size:12px;
        font-weight:bold;margin:15px 0 7px
      }
      .login-card input{
        width:100%;padding:13px;
        border:1px solid #eae5df;border-radius:9px
      }
      .login-card button{
        width:100%;margin-top:22px;
        padding:14px;background:#765087;
        color:white;border:0;border-radius:9px;
        font-weight:bold;cursor:pointer
      }
      #loginErro{color:#b33;font-size:12px;margin-top:12px}
    </style>
  `);

  $('loginForm').addEventListener('submit',fazerLogin);
  controlarTela(false);
}

function controlarTela(logado) {
  document.querySelectorAll('header,main,footer')
    .forEach(el=>el.style.display=logado?'':'none');

  $('loginScreen').style.display=logado?'none':'flex';
}

async function fazerLogin(evento) {
  evento.preventDefault();

  const botao = $('loginButton');
  const erro = $('loginErro');

  botao.disabled = true;
  botao.textContent = 'Verificando...';
  erro.textContent = '';

  try {
    const resultado = await chamarServidor(
      'apiLogin',
      $('loginUsuario').value,
      $('loginSenha').value
    );

    TOKEN = resultado.token;
    USUARIO = resultado.usuario;

    sessionStorage.setItem('menalmei_token',TOKEN);

    controlarTela(true);
    prepararPainel();
  } catch(e) {
    erro.textContent = e.message;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar no sistema';
  }
}

async function sair() {
  try {
    await chamarServidor('apiSair',TOKEN);
  } catch(e) {}

  TOKEN = '';
  USUARIO = null;

  sessionStorage.removeItem('menalmei_token');
  location.reload();
}

/* ==========================================
   INICIALIZAÇÃO DA INTERFACE
========================================== */

async function prepararPainel() {
  const topo = document.querySelector('.topbar');

  if (!$('logoutButton')) {
    topo.insertAdjacentHTML('beforeend',`
      <div style="display:flex;gap:10px;align-items:center">
        <span id="usuarioAtual"
          style="font-size:12px;color:#fff"></span>
        <button id="logoutButton"
          style="background:#765087;color:white"
          onclick="sair()">Sair</button>
      </div>
    `);
  }

  $('usuarioAtual').textContent =
    USUARIO.nome + (USUARIO.perfil==='admin'
      ? ' • Administrador'
      : ' • Entregador');

  const admin = USUARIO.perfil === 'admin';

  document.querySelectorAll('.navigation button')
  .forEach((botao,i)=>{
    if (!admin && i===2) botao.style.display='none';
  });

document.querySelectorAll('.admin-only')
  .forEach(botao => {
    botao.style.display = admin ? '' : 'none';
  });

  if (!admin) {
    document.querySelectorAll('.navigation button')[1]
      .textContent = 'Minhas entregas';

    document.querySelector('.welcome h1').textContent =
      'Minhas entregas';
  }

  $('currentDate').textContent =
    new Date().toLocaleDateString('pt-BR');

  $('dataSemana').value =
    new Date().toLocaleDateString('en-CA');

  $('deliveryForm').addEventListener('submit',salvarEntrega);

  $('veiculo').addEventListener('change',calcularTaxa);

$('alterarSenhaForm').addEventListener(
  'submit',
  alterarMinhaSenha
);

$('redefinirSenhaForm').addEventListener(
  'submit',
  redefinirSenhaEntregador
);

$('courierForm').addEventListener(
  'submit',
  salvarNovoEntregador
);

  if (!admin) {
    $('entregas').querySelector('.panel').style.display='none';
  }

  await carregarEntregadores();
  await atualizarPainel();

  iniciarAtualizacaoAutomatica();
}

async function carregarEntregadores() {
  try {
    ENTREGADORES = await chamarServidor(
      'apiListarEntregadores',TOKEN
    );

    $('entregador').innerHTML = ENTREGADORES.map(e=>
      `<option value="${escapar(e.id)}">${escapar(e.nome)}</option>`
    ).join('');

  } catch(e) {
    aviso(e.message);
  }
}

function calcularTaxa() {
  $('taxa').value =
    $('veiculo').value === 'Bicicleta' ? '6' : '7';
}

/* ==========================================
   NAVEGAÇÃO
========================================== */


function abrirAba(nome,botao) {

  document.querySelectorAll('.tab-content')
    .forEach(el=>el.classList.add('hidden'));

  $(nome).classList.remove('hidden');

  document.querySelectorAll('.nav-button')
    .forEach(el=>el.classList.remove('active'));

  document.querySelectorAll('.mobile-nav-button')
    .forEach(el=>el.classList.remove('active'));

  if (botao) {
    botao.classList.add('active');
  }

  const botaoMobile = document.querySelector(
    `.mobile-nav-button[data-aba="${nome}"]`
  );

  if (botaoMobile) {
    botaoMobile.classList.add('active');
  }

  const menuMais = $('menuMaisMobile');

  if (menuMais) {
    menuMais.classList.add('hidden');
  }

  if (nome==='inicio') atualizarPainel();
  if (nome==='entregas') carregarEntregas();
  if (nome==='fechamento') carregarFechamento();
  if (nome==='gerenciar') carregarGerenciamento();
  if (nome==='configuracoes') carregarConfiguracoes();
}


/* ==========================================
   CADASTRO DE ENTREGA
========================================== */

async function salvarEntrega(evento) {
  evento.preventDefault();

  if (USUARIO.perfil!=='admin') return;

  const botao = $('deliveryForm').querySelector('button[type=submit]');
  botao.disabled = true;
  botao.textContent = 'Salvando...';

  const dados = {
  cliente:$('cliente').value,
  origem:$('origem').value,
  localizador:$('localizador').value,
  endereco:$('endereco').value,
  referencia:$('referencia').value,
  entregadorID:$('entregador').value,
  veiculo:$('veiculo').value,
  taxa:$('taxa').value,
  observacao:$('observacao').value
};

  try {
    await chamarServidor('apiCriarEntrega',TOKEN,dados);

    aviso('Entrega cadastrada com sucesso!');

    $('deliveryForm').reset();
    calcularTaxa();

    await carregarEntregas();
    await atualizarPainel();

  } catch(e) {
    aviso(e.message);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Cadastrar entrega';
  }
}

/* ==========================================
   LISTA DE ENTREGAS
========================================== */


async function carregarEntregas() {
  try {
    const entregas = await chamarServidor(
      'apiListarEntregas',TOKEN
    );

    const lista = $('deliveryList');

const quantidadeAguardando = entregas.filter(
  e => e.status === 'Aguardando'
).length;

const quantidadeRota = entregas.filter(
  e => e.status === 'Saiu para entrega'
).length;

const quantidadeConcluidos = entregas.filter(
  e => e.status === 'Entregue'
).length;

$('btnAguardando').textContent =
  `Aguardando (${quantidadeAguardando})`;

$('btnRota').textContent =
  `Em rota (${quantidadeRota})`;

$('btnConcluidos').textContent =
  `Concluídos (${quantidadeConcluidos})`;

const entregasFiltradas = entregas.filter(e => {

  if (categoriaEntregaAtiva === 'aguardando') {
    return e.status === 'Aguardando';
  }

  if (categoriaEntregaAtiva === 'rota') {
    return e.status === 'Saiu para entrega';
  }

  if (categoriaEntregaAtiva === 'concluidos') {
    return e.status === 'Entregue';
  }

  return false;
});

if (!entregasFiltradas.length) {
  const mensagens = {
    aguardando: 'Nenhum pedido aguardando.',
    rota: 'Nenhum pedido em rota.',
    concluidos: 'Nenhum pedido concluído.'
  };

  lista.innerHTML =
    `<div class="loading">${mensagens[categoriaEntregaAtiva]}</div>`;

  return;
}

    lista.innerHTML = entregasFiltradas.map(e=>{
      const entregador = ENTREGADORES.find(
        x=>x.id===e.entregadorID
      );

      const nome = entregador ? entregador.nome : 'Entregador';
      const telefone = entregador ? entregador.telefone : '';

      const statusClass =
        e.status==='Entregue'?'done':
        e.status==='Saiu para entrega'?'out':'waiting';

      let botoes = '';

      if (USUARIO.perfil === 'admin') {
        botoes += `
          <button
            onclick="excluirEntrega('${escapar(e.id)}')"
            style="background:#b83232;color:white">
            Excluir pedido
          </button>
        `;
      }

      if (e.status==='Aguardando') {
  botoes += `
    <button
      onclick="alterarStatus('${escapar(e.id)}','Saiu para entrega')"
      style="background:#E67E22;color:white">
      Saiu para entrega
    </button>`;
}

      if (e.status!=='Entregue') {
  botoes += `
    <button
      onclick="alterarStatus('${escapar(e.id)}','Entregue')"
      style="background:#2e7d32;color:white">
      Marcar entregue
    </button>`;
}

      const mapa = 'https://www.google.com/maps/search/?api=1&query='+
        encodeURIComponent(e.endereco);

      const mensagem =
        `MENALMEI DELIVERY\nCliente: ${e.cliente}\nEndereço: ${e.endereco}\nReferência: ${e.referencia || '-'}\nTaxa: ${moeda(e.taxa)}`;

      const botaoLocalizador = e.localizador ? `
  <button
    onclick="copiarLocalizador('${encodeURIComponent(e.localizador)}')"
    style="background:#6A1B9A;color:white">
    Copiar Localizador
  </button>
` : '';

      return `
        <article class="delivery-card" style="
  border-left:5px solid ${
    e.status === 'Aguardando' ? '#E67E22' :
    e.status === 'Saiu para entrega' ? '#1565C0' :
    '#2E7D32'
  };
">
          <div style="display:flex;justify-content:space-between;gap:10px">
            <div>
              <h3>${escapar(e.cliente)}</h3>
              <span class="pill ${statusClass}">
                ${escapar(e.status)}
              </span>
            </div>
            <strong>${moeda(e.taxa)}</strong>
          </div>

          <p>
            ${escapar(e.endereco)}<br>
            ${e.referencia?'Referência: '+escapar(e.referencia)+'<br>':''}
            ${escapar(e.origem)} • ${escapar(nome)} • ${escapar(e.veiculo)}
          </p>

          ${e.localizador ? `
            <p>
              <strong>Localizador:</strong>
              ${escapar(e.localizador)}
            </p>
          ` : ''}

${e.observacao ? `
  <p style="color:#c62828;font-weight:bold;">
    <strong>Observação:</strong>
    ${escapar(e.observacao)}
  </p>
` : ''}

          <div class="actions">
            ${botaoLocalizador}
            ${botaoConfirmacao(e.origem)}
            ${botoes}
            <button
  		onclick="window.open('${mapa}','_blank')"
  		style="background:#1976d2;color:white">
  		Abrir mapa
            ${USUARIO.perfil === 'admin' ? `
  	    <button onclick="compartilharWhatsApp('${telefone}','${encodeURIComponent(mensagem)}')">
            Whatsapp
            </button>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

  } catch(e) {
    aviso(e.message);
  }
}


async function alterarStatus(id,status) {
  try {
    await chamarServidor(
      'apiAtualizarStatus',TOKEN,id,status
    );

    await carregarEntregas();
    await atualizarPainel();

  } catch(e) {
    aviso(e.message);
  }
}


function compartilharWhatsApp(telefone, mensagem) {
  telefone = String(telefone || '').replace(/\D/g, '');

  if (!telefone) {
    aviso('Este entregador ainda não possui telefone cadastrado.');
    return;
  }

  if (telefone.length === 10 || telefone.length === 11) {
    telefone = '55' + telefone;
  }

  if (!/^55\d{10,11}$/.test(telefone)) {
    aviso('O telefone do entregador é inválido.');
    return;
  }

  window.open(
    'https://wa.me/' + telefone + '?text=' + mensagem,
    '_blank'
  );
}


/* ==========================================
   PAINEL PRINCIPAL
========================================== */

async function atualizarPainel() {
  try {
    const resumo = await chamarServidor(
      'apiResumo',TOKEN
    );

    $('totalEntregas').textContent = resumo.total;
    $('aguardando').textContent = resumo.aguardando;
    $('emRota').textContent = resumo.emRota;
    $('totalTaxas').textContent = moeda(resumo.taxas);

    const entregas = await chamarServidor(
      'apiListarEntregas',TOKEN
    );

    const cards = $('courierGrid');

    if (USUARIO.perfil==='admin') {
      cards.innerHTML = ENTREGADORES.map(entregador=>{
        const lista = entregas.filter(
          e=>e.entregadorID===entregador.id
        );

        const total = lista.reduce(
          (s,e)=>s+Number(e.taxa),0
        );

        return `
          <div class="courier-card">
            <h3>${escapar(entregador.nome)}</h3>
            <p>${lista.length} entregas cadastradas</p>
            <strong>${moeda(total)}</strong>
          </div>
        `;
      }).join('');
    } else {
      cards.innerHTML = `
        <div class="courier-card">
          <h3>${escapar(USUARIO.nome)}</h3>
          <p>${resumo.total} entregas nesta semana</p>
          <strong>${moeda(resumo.taxas)}</strong>
        </div>
      `;
    }

  } catch(e) {
    aviso(e.message);
  }
}

/* ==========================================
   FECHAMENTO SEMANAL
========================================== */

async function carregarFechamento() {
  try {
    const data = $('dataSemana').value;

    const resultado = await chamarServidor(
      'apiFechamento',TOKEN,data
    );

    let html = `
      <div style="margin:18px 0;font-weight:bold">
        Período: ${escapar(resultado.inicio)} até
        ${escapar(resultado.fim)}
      </div>
    `;

    resultado.entregadores.forEach(e=>{
      html += `
        <div class="delivery-card" style="margin-top:10px">
          <h3>${escapar(e.nome)}</h3>
          <p>${e.quantidade} entregas realizadas</p>
          <strong>${moeda(e.total)}</strong>

          ${USUARIO.perfil==='admin'?`
            <div style="margin-top:12px">
              <button onclick="marcarPagamento('${escapar(e.entregadorID)}',${!e.pago})">
                ${e.pago?'Pagamento realizado ✓':'Marcar como pago'}
              </button>
            </div>
          `:''}

        </div>
      `;
    });

    $('fechamentoResultado').innerHTML = html;

  } catch(e) {
    aviso(e.message);
  }
}

async function marcarPagamento(id,pago) {
  try {
    await chamarServidor(
      'apiMarcarPagamento',
      TOKEN,
      id,
      $('dataSemana').value,
      pago
    );

    await carregarFechamento();

  } catch(e) {
    aviso(e.message);
  }
}


async function excluirEntrega(id) {
  const confirmar = confirm(
    'Tem certeza que deseja excluir este pedido?\n\n' +
    'Essa ação não poderá ser desfeita.'
  );

  if (!confirmar) return;

  try {
    await chamarServidor('apiExcluirEntrega', TOKEN, id);

    aviso('Pedido excluído com sucesso!');

    await carregarEntregas();
    await atualizarPainel();

  } catch (e) {
    aviso(e.message);
  }
}


function iniciarAtualizacaoAutomatica() {

  if (intervaloAtualizacao) {
    clearInterval(intervaloAtualizacao);
  }

  intervaloAtualizacao = setInterval(async () => {

    if (!TOKEN || !USUARIO) return;

    const abaAtiva = document.querySelector(
      '.tab-content:not(.hidden)'
    );

    if (!abaAtiva) return;

    try {
      if (abaAtiva.id === 'inicio') {
        await atualizarPainel();
      }

      if (abaAtiva.id === 'entregas') {
        await carregarEntregas();
      }

      if (abaAtiva.id === 'fechamento') {
        await carregarFechamento();
      }

    } catch (erro) {
      console.error('Atualização automática:', erro);
    }

  }, 5000);
}


async function carregarGerenciamento() {
  try {
    TODOS_ENTREGADORES = await chamarServidor(
      'apiListarTodosEntregadores',
      TOKEN
    );

    const lista = $('courierManagementList');

    if (!TODOS_ENTREGADORES.length) {
      lista.innerHTML = '<div class="loading">Nenhum entregador cadastrado.</div>';
      return;
    }

    lista.innerHTML = TODOS_ENTREGADORES.map(e => `
      <article class="delivery-card">

        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">

          <div>
            <h3>${escapar(e.nome)}</h3>
            <p>Usuário: ${escapar(e.usuario)}</p>
            <p>Veículo: ${escapar(e.veiculo)}</p>
	    <p>WhatsApp: ${escapar(e.telefone || 'Não informado')}</p>
	    <p>ID: ${escapar(e.id)}</p>
          </div>

          <strong style="color:${e.ativo ? '#23864b' : '#b83232'}">
            ${e.ativo ? 'ATIVO' : 'INATIVO'}
          </strong>

        </div>

        <div class="actions" style="margin-top:15px">

          <button onclick="editarEntregador('${escapar(e.id)}')">
            Editar
          </button>

          <button
            style="background:${e.ativo ? '#b83232' : '#23864b'};color:white"
            onclick="alterarStatusEntregador('${escapar(e.id)}',${!e.ativo})">

            ${e.ativo ? 'Desativar' : 'Ativar'}

          </button>
<button
  style="background:#8b2525;color:white"
  onclick="excluirEntregador('${escapar(e.id)}')">

  Excluir

</button>

        </div>

      </article>
    `).join('');

  } catch(e) {
    aviso(e.message);
  }
}


// CADASTRAR
async function salvarNovoEntregador(evento) {
  evento.preventDefault();

  const botao = $('courierForm').querySelector(
    'button[type="submit"]'
  );

  botao.disabled = true;
  botao.textContent = 'Cadastrando...';

  const dados = {
    nome: $('novoEntregadorNome').value,
    usuario: $('novoEntregadorUsuario').value,
    senha: $('novoEntregadorSenha').value,
    veiculo: $('novoEntregadorVeiculo').value,
    telefone: $('novoEntregadorTelefone').value
  };

  try {
    await chamarServidor(
      'apiCriarEntregador',
      TOKEN,
      dados
    );

    aviso('Entregador cadastrado com sucesso!');

    $('courierForm').reset();

    await carregarGerenciamento();
    await carregarEntregadores();
    await atualizarPainel();

  } catch(e) {
    aviso(e.message);

  } finally {
    botao.disabled = false;
    botao.textContent = 'Adicionar entregador';
  }
}


// EDITAR

async function editarEntregador(id) {
  const entregador = TODOS_ENTREGADORES.find(
    e => e.id === id
  );

  if (!entregador) return;

  const nome = prompt(
    'Nome do entregador:',
    entregador.nome
  );

  if (nome === null) return;

  const veiculo = prompt(
    'Veículo do entregador:',
    entregador.veiculo
  );

  if (veiculo === null) return;

  const telefone = prompt(
    'Telefone / WhatsApp com DDD:',
    entregador.telefone || ''
  );

  if (telefone === null) return;

  try {
    await chamarServidor(
      'apiEditarEntregador',
      TOKEN,
      id,
      nome,
      veiculo,
      telefone
    );

    aviso('Cadastro atualizado com sucesso!');

    await carregarGerenciamento();
    await carregarEntregadores();
    await atualizarPainel();

  } catch(e) {
    aviso(e.message);
  }
}



// ATIVAR OU DESATIVAR
async function alterarStatusEntregador(id, ativo) {
  const mensagem = ativo
    ? 'Deseja reativar este entregador?'
    : 'Deseja desativar este entregador?';

  if (!confirm(mensagem)) return;

  try {
    await chamarServidor(
      'apiAlterarStatusEntregador',
      TOKEN,
      id,
      ativo
    );

    aviso(
      ativo
        ? 'Entregador ativado!'
        : 'Entregador desativado!'
    );

    await carregarGerenciamento();
    await carregarEntregadores();
    await atualizarPainel();

  } catch(e) {
    aviso(e.message);
  }
}

/* ==========================================
   INÍCIO
========================================== */


window.addEventListener('load',async()=>{
  criarTelaLogin();

  if (!TOKEN) return;

  try {
    USUARIO = await chamarServidor(
      'apiValidarSessao',TOKEN
    );

    controlarTela(true);
    prepararPainel();

  } catch(e) {
    TOKEN = '';
    USUARIO = null;
    sessionStorage.removeItem('menalmei_token');
    controlarTela(false);
  }
});


async function excluirEntregador(id) {

  const entregador = TODOS_ENTREGADORES.find(
    e => e.id === id
  );

  if (!entregador) return;

  const confirmar = confirm(
    'ATENÇÃO!\n\n' +
    'Deseja excluir definitivamente ' +
    entregador.nome + '?\n\n' +
    'Essa ação não poderá ser desfeita.'
  );

  if (!confirmar) return;

  try {
    await chamarServidor(
      'apiExcluirEntregador',
      TOKEN,
      id
    );

    aviso('Entregador excluído com sucesso!');

    await carregarGerenciamento();
    await carregarEntregadores();
    await atualizarPainel();

  } catch(e) {
    aviso(e.message);
  }
}


async function carregarConfiguracoes() {
  try {
    TODOS_ENTREGADORES = await chamarServidor(
      'apiListarTodosEntregadores',
      TOKEN
    );

    const select = $('entregadorSenha');

    select.innerHTML =
      '<option value="">Selecione um entregador</option>';

    TODOS_ENTREGADORES.forEach(e => {
      const option = document.createElement('option');

      option.value = e.id;
      option.textContent =
        e.nome + (e.ativo ? ' (Ativo)' : ' (Inativo)');

      select.appendChild(option);
    });

  } catch(e) {
    aviso(e.message);
  }
}


// ALTERAR MINHA SENHA
async function alterarMinhaSenha(evento) {
  evento.preventDefault();

  const atual = $('senhaAtual').value;
  const nova = $('novaSenha').value;
  const confirmar = $('confirmarNovaSenha').value;

  if (nova !== confirmar) {
    aviso('As novas senhas não coincidem.');
    return;
  }

  if (nova.length < 6) {
    aviso('A nova senha deve ter pelo menos 6 caracteres.');
    return;
  }

  try {
    await chamarServidor(
      'apiAlterarMinhaSenha',
      TOKEN,
      atual,
      nova
    );

    $('alterarSenhaForm').reset();

    aviso('Sua senha foi alterada com sucesso!');

  } catch(e) {
    aviso(e.message);
  }
}


// REDEFINIR SENHA DO ENTREGADOR
async function redefinirSenhaEntregador(evento) {
  evento.preventDefault();

  const id = $('entregadorSenha').value;
  const nova = $('senhaEntregador').value;
  const confirmar = $('confirmarSenhaEntregador').value;

  if (!id) {
    aviso('Selecione um entregador.');
    return;
  }

  if (nova !== confirmar) {
    aviso('As novas senhas não coincidem.');
    return;
  }

  if (nova.length < 6) {
    aviso('A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  if (!confirm(
    'Deseja realmente redefinir a senha deste entregador?'
  )) {
    return;
  }

  try {
    await chamarServidor(
      'apiRedefinirSenhaEntregador',
      TOKEN,
      id,
      nova
    );

    $('redefinirSenhaForm').reset();

    aviso('Senha do entregador redefinida com sucesso!');

  } catch(e) {
    aviso(e.message);
  }
}


async function consultarHistorico() {
  const dataConsulta = $('dataHistorico').value;
  const lista = $('historicoList');

  if (!dataConsulta) {
    aviso('Selecione uma data para consultar.');
    return;
  }

  lista.innerHTML = '<div class="loading">Consultando histórico...</div>';

  try {
    const entregas = await chamarServidor(
      'apiConsultarHistoricoEntregas',
      TOKEN,
      dataConsulta
    );

    if (!entregas.length) {
      lista.innerHTML =
        '<div class="loading">Nenhuma entrega encontrada nesta data.</div>';
      return;
    }

    lista.innerHTML = entregas.map(e => {
      const entregador = ENTREGADORES.find(
        x => x.id === e.entregadorID
      );

      const nomeEntregador = entregador
        ? entregador.nome
        : 'Entregador';

      const statusClass =
        e.status === 'Entregue' ? 'done' :
        e.status === 'Saiu para entrega' ? 'out' :
        'waiting';

      const mapa =
        'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(e.endereco);

      const mensagem =
        `MENALMEI DELIVERY\n` +
        `Cliente: ${e.cliente}\n` +
        `Endereço: ${e.endereco}\n` +
        `Referência: ${e.referencia || '-'}\n` +
        `Taxa: ${moeda(e.taxa)}`;

      const telefone = entregador
        ? entregador.telefone
        : '';

      const botaoLocalizador = e.localizador ? `
  <button
    onclick="copiarLocalizador('${encodeURIComponent(e.localizador)}')"
    style="background:#6A1B9A;color:white">
    Copiar Localizador
  </button>
` : '';

      return `
        <article class="delivery-card">

          <div class="delivery-header">
            <div>
              <strong>${escapar(e.cliente)}</strong>
              <div>${escapar(e.hora)}</div>
            </div>

            <span class="status ${statusClass}">
              ${escapar(e.status)}
            </span>
          </div>

          <div class="delivery-details">
            <p><strong>Origem:</strong> ${escapar(e.origem)}</p>
            ${e.localizador ? `<p><strong>Localizador:</strong> ${escapar(e.localizador)}</p>` : ''}
            <p><strong>Endereço:</strong> ${escapar(e.endereco)}</p>
            <p><strong>Referência:</strong> ${escapar(e.referencia || '-')}</p>
            <p><strong>Entregador:</strong> ${escapar(nomeEntregador)}</p>
            <p><strong>Veículo:</strong> ${escapar(e.veiculo)}</p>
            <p><strong>Taxa:</strong> ${moeda(e.taxa)}</p>
            <p><strong>Observação:</strong> ${escapar(e.observacao || '-')}</p>
          </div>

          <div class="delivery-actions">

            ${botaoLocalizador}
            ${botaoConfirmacao(e.origem)}

            <button onclick="window.open('${mapa}','_blank')">
              Abrir mapa
            </button>

            <button onclick="compartilharWhatsApp('${telefone}','${encodeURIComponent(mensagem)}')">
              WhatsApp
            </button>

          </div>

        </article>
      `;
    }).join('');

  } catch (e) {
    lista.innerHTML = '';
    aviso(e.message);
  }
}


async function copiarLocalizador(codigo) {
  try {
    const localizador = decodeURIComponent(codigo);

    await navigator.clipboard.writeText(localizador);

    aviso('Localizador copiado!');
  } catch(e) {
    aviso('Não foi possível copiar o localizador.');
  }
}

function botaoConfirmacao(origem) {
  if (origem === 'iFood') {
    return `
      <button
        onclick="window.open('https://confirmacao-entrega-propria.ifood.com.br/numero-pedido','_blank')"
        style="background:#d32f2f;color:white">
        Confirmar iFood
      </button>
    `;
  }

  if (origem === '99Food') {
    return `
      <button
        onclick="window.open('https://food-b-h5.99app.com/pt-BR/v2/confirmation-entrega','_blank')"
        style="background:#fbc02d;color:#222">
        Confirmar 99Food
      </button>
    `;
  }

  return '';
}

function abrirCategoriaEntrega(categoria) {

  categoriaEntregaAtiva = categoria;

  const botoes = {
    aguardando: $('btnAguardando'),
    rota: $('btnRota'),
    concluidos: $('btnConcluidos')
  };

  const cores = {
    aguardando: '#E67E22',
    rota: '#1565C0',
    concluidos: '#2E7D32'
  };

  Object.keys(botoes).forEach(chave => {
    botoes[chave].style.opacity =
      chave === categoria ? '1' : '0.55';

    botoes[chave].style.transform =
      chave === categoria ? 'scale(1.03)' : 'scale(1)';
  });

  carregarEntregas();
}

function alternarMenuMais() {

  const menu = $('menuMaisMobile');

  if (!menu) return;

  menu.classList.toggle('hidden');

}