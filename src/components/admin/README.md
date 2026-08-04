# Admin

## Tres camadas de protecao, nao uma

1. `requireAdminPagina()` no `layout.tsx` - quem nao e admin nao recebe o HTML.
2. `requireAdmin()` dentro de CADA Server Action - a action e um endpoint;
   da para chamar sem passar por pagina nenhuma. Esconder o menu nao cobre isso.
3. RLS e as proprias RPCs (`admin_salvar_questao`, `admin_publicar_questao`,
   `admin_resumo`) validam `is_admin()` no banco.

Se as duas primeiras falharem, a terceira ainda recusa.

## Capa da materia

O admin escolhe qualquer foto. O navegador corta em 16:9 pelo centro,
redimensiona para no maximo 1280x720 e converte para WebP ANTES de subir
(`lib/imagem.ts`). O Storage recebe um arquivo pequeno e ja na proporcao do
card - sem isso, ou a capa distorce ou alguem corta a mao toda vez.

Materia sem capa nao fica vazia: `capaFallbackDataUri` desenha uma arte
deterministica com as iniciais, na paleta da marca. Mesma materia, mesma
arte, sempre.

## Publicar pode falhar - e tudo bem

O trigger da migration 0001 recusa questao sem 5 alternativas ou sem gabarito
unico. O `EditorQuestao` confere antes e explica o que falta, mas nao confia
na propria conferencia: quem decide e o banco, e o erro dele aparece na tela.
Engolir esse erro daria a impressao de que publicou.
