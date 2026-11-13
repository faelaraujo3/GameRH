# 🎯 Círculo Premiado — Jogo Online de Novas Abordagens de Remuneração

Aplicação web interativa, mobile-first e sincronizada em tempo real para dinâmica universitária sobre **Novas Abordagens de Remuneração** (inspirada no visual do *Gartic Phone*, na simplicidade do *Kahoot* e na mecânica do *Draw the Perfect Circle*).

---

## 🚀 Três Ambientes do Jogo

| Ambiente | Endereço (Rota) | Quem utiliza |
| :--- | :--- | :--- |
| **📱 Participante (Mobile)** | `/` (ou via QR Code `/?sala=XXXX`) | Alunos pelo celular |
| **💻 Administrador (Notebook)** | `/admin` (PIN padrão: `1234`) | Administrador / Apresentador |
| **🏆 Placar Projetor (Desktop)** | `/placar` | Telão / Projetor da sala |

---

## 📖 Tutorial Passo a Passo para Utilizar em Sala de Aula

### Opção 1: Mais Rápida (Sem criar contas — Direto do seu Notebook para a Internet)

Se você está com o projeto no seu notebook e quer gerar um link público da internet (`https://...`) em **5 segundos** para os alunos acessarem pelo 4G/5G ou Wi-Fi da faculdade:

1. **Inicie o jogo no notebook**:
   - Dê dois cliques no arquivo **`INICIAR_JOGO.bat`** (ou abra o terminal na pasta e digite `npm run dev`).
2. **Gere o link público gratuito da internet**:
   - Abra uma segunda janela do terminal (PowerShell ou CMD) e execute:
     ```bash
     npx localtunnel --port 3000
     ```
     *(Ou, se preferir o túnel da Cloudflare: `npx cloudflared tunnel --url http://localhost:3000`)*
   - O terminal exibirá um endereço público na internet (ex.: `https://xxxx.trycloudflare.com` ou `https://xxxx.loca.lt`).
3. **Configure o QR Code no Painel Admin**:
   - No seu notebook, acesse **`http://localhost:3000/admin`** e digite o PIN **`1234`**.
   - Cole o endereço público gerado no campo **"Endereço público opcional para o QR Code"** e clique em **Fixar URL**.
   - Pronto! O QR Code agora aponta para o endereço público da internet e qualquer aluno na sala pode escanear com a câmera do celular!

---

### Opção 2: Publicação Permanente na Nuvem (Render.com / Railway — Gratuito)

Caso queira deixar o jogo hospedado permanentemente na nuvem:

1. Crie uma conta gratuita no [GitHub](https://github.com) e envie esta pasta para um repositório.
2. Crie uma conta gratuita no [Render.com](https://render.com) (ou [Railway.app](https://railway.app)).
3. No Render, clique em **New +** → **Web Service** e conecte seu repositório do GitHub.
4. O arquivo `render.yaml` já configura tudo automaticamente:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Variável de ambiente opcional**: `ADMIN_PIN` = `1234` (você pode escolher qualquer PIN).
5. Ao finalizar a publicação, você receberá um link público como `https://circulo-premiado.onrender.com`:
   - Abra `https://circulo-premiado.onrender.com/admin` no notebook.
   - Abra `https://circulo-premiado.onrender.com/placar` na aba projetada no telão.
   - Compartilhe o QR Code com a turma!

---

## 🎮 Como Conduzir as 5 Rodadas na Apresentação

1. **Recepção dos alunos**:
   - Projete a tela **`/placar`** no projetor da sala ou clique em **"Ampliar QR Code"** no painel `/admin`.
   - Peça para os ~15 participantes escanearem o QR Code e escolherem um apelido.
2. **Rodada 1 — Remuneração Funcional (30s)**:
   - Explique a regra e clique em **"Iniciar Rodada 1 (30s)"**.
   - Ao terminar o tempo, todos os participantes presentes recebem **R$ 500,00** fixos.
3. **Rodada 2 — Remuneração Variável por Produtividade (30s)**:
   - Clique em **"Avançar para Rodada 2"** e depois em **"Iniciar Rodada 2 (30s)"**.
   - Cada círculo válido concluído rende **R$ 50,00**.
4. **Rodada 3 — Remuneração por Habilidades (30s)**:
   - Clique em **"Avançar para Rodada 3"** e depois em **"Iniciar Rodada 3 (30s)"**.
   - Vale apenas o círculo de **maior precisão** da rodada (até **R$ 600,00** para precisão ≥ 95%).
5. **Rodada 4 — Remuneração por Metas (30s)**:
   - Clique em **"Avançar para Rodada 4"** e depois em **"Iniciar Rodada 4 (30s)"**.
   - Meta: produzir pelo menos 5 círculos com precisão ≥ 80% (**R$ 500,00**) ou 8+ círculos com precisão ≥ 80% (**R$ 800,00** substitutivo).
6. **Rodada 5 — Remuneração por Competências (30s)**:
   - Clique em **"Avançar para Rodada 5"** e depois em **"Iniciar Rodada 5 (30s)"**.
   - Exige mínimo de 5 círculos válidos e remunera pela **média de precisão dos últimos 5 círculos válidos** (até **R$ 600,00**).
7. **Encerramento e Debate Pedagógico**:
   - Clique em **"Exibir Pódio Final e Vencedores"**.
   - O telão mostrará o pódio animado com confetes, o total distribuído em cada modalidade e o quadro comparativo sobre os comportamentos incentivados por cada modelo de remuneração!
