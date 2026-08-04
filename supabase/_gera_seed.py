import unicodedata, re

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s

def q(s):
    return "'" + s.replace("'", "''") + "'" if s is not None else 'null'

def n(v):
    return 'null' if v is None else str(v)

# (codigo, nome, creditos, ch_total, teo, pra, afec, [prerequisitos por nome])
M = {
1: [
 ("MV200262","Anatomia Veterinaria I|Anatomia Veterinária I",5,100,20,60,20,[]),
 ("MV200178","Biofisica|Biofísica",2,40,36,4,None,[]),
 ("MV200177","Biologia Celular e Molecular|Biologia Celular e Molecular",4,80,40,20,20,[]),
 ("MV200252","Bioquimica Veterinaria|Bioquímica Veterinária",4,80,40,40,None,[]),
 ("MV200195","Informatica Veterinaria|Informática Veterinária",2,40,40,None,None,[]),
 ("MV200173","Introducao a Medicina Veterinaria|Introdução à Medicina Veterinária",1,20,16,4,None,[]),
 ("MV200269","Metodologia do Trabalho Cientifico|Metodologia do Trabalho Científico",2,40,40,None,None,[]),
 ("MV200254","Praticas Hospitalares|Práticas Hospitalares",2,40,None,20,20,[]),
],
2: [
 ("MV200263","Anatomia Veterinaria II|Anatomia Veterinária II",5,100,20,60,20,["Anatomia Veterinária I"]),
 ("MV200253","Bioestatistica|Bioestatística",3,60,60,None,None,[]),
 ("MV200255","Sociedade, Politicas Publicas e Extensao Rural|Sociedade, Políticas Públicas e Extensão Rural",2,40,40,None,None,[]),
 ("MV200182","Histologia e Embriologia Veterinaria|Histologia e Embriologia Veterinária",4,80,40,40,None,["Biologia Celular e Molecular"]),
 ("MV200193","Imunologia Veterinaria|Imunologia Veterinária",3,60,60,None,None,[]),
 ("MV200094","Parasitologia Veterinaria|Parasitologia Veterinária",4,80,50,20,10,[]),
],
3: [
 ("MV200192","Bioclimatologia e Bem Estar Animal|Bioclimatologia e Bem Estar Animal",2,40,36,4,None,[]),
 ("MV200188","Fisiologia Veterinaria I|Fisiologia Veterinária I",4,80,80,None,None,["Bioquímica Veterinária","Histologia e Embriologia Veterinária"]),
 ("MV200189","Microbiologia Veterinaria|Microbiologia Veterinária",5,100,40,20,20,[]),
 ("MV200183","Genetica Aplicada|Genética Aplicada",3,60,40,None,20,[]),
 ("MV200190","Plantas Forrageiras e Pastagens|Plantas Forrageiras e Pastagens",3,60,30,20,10,[]),
 ("MV200202","Nutricao Animal|Nutrição Animal",3,60,60,None,None,["Bioquímica Veterinária"]),
 ("MV200198","Doencas Parasitarias dos Animais Domesticos|Doenças Parasitárias dos Animais Domésticos",4,80,60,None,20,["Parasitologia Veterinária"]),
],
4: [
 ("MV200217","Semiologia Basica|Semiologia Básica",3,60,40,20,None,["Anatomia Veterinária II"]),
 ("MV200264","Economia e Gestao Aplicada ao Agronegocio|Economia e Gestão Aplicada ao Agronegócio",2,40,30,None,10,[]),
 ("MV200258","Tecnologia de Produtos de Origem Animal|Tecnologia de Produtos de Origem Animal",3,60,60,None,None,["Microbiologia Veterinária"]),
 ("MV200197","Fisiologia Veterinaria II|Fisiologia Veterinária II",5,100,100,None,None,["Fisiologia Veterinária I"]),
 ("MV200203","Melhoramento Animal|Melhoramento Animal",3,60,40,None,20,["Bioestatística","Genética Aplicada"]),
 ("MV200211","Alimentos e Alimentacao|Alimentos e Alimentação",2,40,40,None,None,["Nutrição Animal"]),
 ("MV200213","Doencas Infecto-Contagiosas dos Animais Domesticos|Doenças Infecto-Contagiosas dos Animais Domésticos",4,80,40,20,20,["Microbiologia Veterinária"]),
],
5: [
 ("MV200259","Zootecnia I|Zootecnia I",3,60,50,10,None,["Alimentos e Alimentação"]),
 ("MV200206","Analises Clinicas Veterinarias|Análises Clínicas Veterinárias",3,60,40,20,None,["Biologia Celular e Molecular"]),
 ("MV200265","Empreendedorismo e Gestao de Carreira Aplicada a Medicina Veterinaria|Empreendedorismo e Gestão de Carreira Aplicada à Medicina Veterinária",3,60,40,None,20,[]),
 ("MV200257","Farmacologia Veterinaria e Toxicologia|Farmacologia Veterinária e Toxicologia",4,80,100,None,None,["Bioquímica Veterinária"]),
 ("MV200207","Patologia Veterinaria Geral|Patologia Veterinária Geral",4,80,40,40,None,["Fisiologia Veterinária II","Anatomia Veterinária II"]),
 ("MV200235","Inspecao de Leite, Produtos Lacteos e Mel|Inspeção de Leite, Produtos Lácteos e Mel",3,60,40,10,10,["Tecnologia de Produtos de Origem Animal"]),
 ("MV200256","Diagnostico por Imagem|Diagnóstico por Imagem",3,60,40,20,None,["Anatomia Veterinária II"]),
],
6: [
 ("MV200230","Anestesiologia Veterinaria|Anestesiologia Veterinária",3,60,40,10,10,["Farmacologia Veterinária e Toxicologia"]),
 ("MV200214","Patologia Veterinaria Especial|Patologia Veterinária Especial",5,100,40,60,None,["Patologia Veterinária Geral"]),
 ("MV200224","Tecnica Cirurgica|Técnica Cirúrgica",4,80,40,40,None,["Anatomia Veterinária II"]),
 ("MV2002015","Terapeutica Veterinaria|Terapêutica Veterinária",3,60,50,10,None,["Farmacologia Veterinária e Toxicologia"]),
 ("MV200260","Zootecnia II|Zootecnia II",3,60,50,10,None,["Alimentos e Alimentação"]),
 ("MV200236","Inspecao de Carne, Pescados, Ovos e Derivados|Inspeção de Carne, Pescados, Ovos e Derivados",3,60,45,5,10,["Tecnologia de Produtos de Origem Animal"]),
 ("MV200266","Praticas Extensionistas|Práticas Extensionistas",2,40,None,None,40,[]),
],
7: [
 ("MV200261","Clinica Cirurgica de Caes e Gatos|Clínica Cirúrgica de Cães e Gatos",4,80,40,30,10,["Técnica Cirúrgica"]),
 ("MV200228","Ginecologia e Andrologia Veterinaria|Ginecologia e Andrologia Veterinária",4,80,70,10,None,["Patologia Veterinária Especial"]),
 ("MV200227","Epidemiologia, Zoonoses e Saude Publica|Epidemiologia, Zoonoses e Saúde Pública",4,80,50,10,20,["Doenças Infecto-Contagiosas dos Animais Domésticos","Doenças Parasitárias dos Animais Domésticos"]),
 ("MV200270","Semiologia e Clinica de Animais Silvestres|Semiologia e Clínica de Animais Silvestres",4,80,50,10,20,["Patologia Veterinária Especial","Semiologia Básica","Terapêutica Veterinária"]),
 ("MV200229","Semiologia e Clinica Medica de Caes e Gatos I|Semiologia e Clínica Médica de Cães e Gatos I",3,60,40,10,10,["Patologia Veterinária Especial","Semiologia Básica","Terapêutica Veterinária"]),
 ("MV200234","Semiologia e Clinica Medica de Ruminantes I|Semiologia e Clínica Médica de Ruminantes I",3,60,40,10,10,["Patologia Veterinária Especial","Semiologia Básica","Terapêutica Veterinária"]),
],
8: [
 ("MV200246","Clinica Medica de Ruminantes II|Clínica Médica de Ruminantes II",3,60,50,10,None,["Semiologia e Clínica Médica de Ruminantes I"]),
 ("MV200246","Defesa Sanitaria Animal|Defesa Sanitária Animal",3,60,50,None,10,["Epidemiologia, Zoonoses e Saúde Pública"]),
 ("MV200231","Obstetricia Veterinaria|Obstetrícia Veterinária",3,60,50,10,None,["Ginecologia e Andrologia Veterinária"]),
 ("MV200238","Ornitopatologia|Ornitopatologia",3,60,55,5,None,["Patologia Veterinária Especial"]),
 ("MV200225","Aquicultura|Aquicultura",3,60,30,10,20,["Alimentos e Alimentação"]),
 ("MV200267","Semiologia e Clinica Medica de Caes e Gatos II|Semiologia e Clínica Médica de Cães e Gatos II",3,60,40,10,10,["Semiologia e Clínica Médica de Cães e Gatos I"]),
 ("MV200242","Semiologia e Clinica Medica de Equideos|Semiologia e Clínica Médica de Equídeos",4,80,40,20,20,["Patologia Veterinária Especial","Semiologia Básica","Terapêutica Veterinária"]),
],
9: [
 ("MV200243","Biotecnologia|Biotecnologia",3,60,40,20,None,["Ginecologia e Andrologia Veterinária"]),
 ("MV200244","Clinica Cirurgica de Equideos e Ruminantes|Clínica Cirúrgica de Equídeos e Ruminantes",4,80,70,10,None,["Técnica Cirúrgica"]),
 ("MV200240","Deontologia e Legislacao Veterinaria|Deontologia e Legislação Veterinária",2,40,30,None,10,[]),
 ("MV200271","Estagio Curricular Pratico Hospitalar em Grandes Animais|Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Grandes Animais",2,40,None,40,None,[]),
 ("MV200274","Estagio Curricular Pratico Hospitalar em Pequenos Animais|Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Pequenos Animais",2,40,None,40,None,[]),
 ("MV200275","Estagio Curricular Pratico Hospitalar em Animais Silvestres|Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Animais Silvestres",2,40,None,40,None,[]),
 ("MV200276","Estagio Curricular Pratico Hospitalar em Producao, Reproducao e Obstetricia|Estágio Curricular Prático Hospitalar em Produção, Reprodução e Obstetrícia",2,40,None,40,None,[]),
 ("MV200277","Estagio Curricular Pratico Hospitalar em Tecnologia, Inspecao Sanitaria, Zoonoses, Epidemiologia e Saude Publica|Estágio Curricular Prático Hospitalar em Tecnologia, Inspeção Sanitária, Zoonoses, Epidemiologia e Saúde Pública",2,40,None,40,None,[]),
],
10: [
 ("MV200247","Estagio Supervisionado II|Estágio Supervisionado II",10,200,None,200,None,[]),
 ("MV200273","Trabalho de Conclusao de Curso|Trabalho de Conclusão de Curso",3,60,20,40,None,[]),
 ("MV200168","Lingua Brasileira de Sinais|Língua Brasileira de Sinais",2,40,None,40,None,[]),
 ("MV200251","Optativa I|Optativa I",2,40,40,None,None,[]),
],
}

ATIVAS = {
 "Análises Clínicas Veterinárias",
 "Farmacologia Veterinária e Toxicologia",
 "Patologia Veterinária Geral",
 "Semiologia Básica",
 "Inspeção de Leite, Produtos Lácteos e Mel",
 "Zootecnia I",
 "Aquicultura",
}

NOMES_PERIODO = {1:"1o Periodo",2:"2o Periodo",3:"3o Periodo",4:"4o Periodo",5:"5o Periodo",
                 6:"6o Periodo",7:"7o Periodo",8:"8o Periodo",9:"9o Periodo",10:"10o Periodo"}

out = []
out.append("""-- =============================================================================
-- EstudeVet v11 - Seed
-- Matriz Curricular 2023/1 - Medicina Veterinaria - Faculdade Pio Decimo.
-- Catalogo completo dos 10 periodos. `ativa = true` apenas nas materias que
-- entram no ar agora; as demais ficam cadastradas e desligadas.
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PERIODOS
-- ---------------------------------------------------------------------------
insert into public.periodos (numero, nome) values""")

linhas = [f"  ({p}, {q(NOMES_PERIODO[p])})" for p in range(1,11)]
out.append(",\n".join(linhas) + "\non conflict (numero) do nothing;\n")

out.append("""-- ---------------------------------------------------------------------------
-- MATERIAS
-- `codigo` nao e unico de proposito: a matriz repete MV200246 no 8o periodo.
-- Sem constraint de soma de carga horaria: a matriz traz Farmacologia com
-- CH/P 80 e TEO 100.
-- ---------------------------------------------------------------------------
insert into public.materias
  (periodo_id, codigo, nome, slug, creditos, ch_total, ch_teorica, ch_pratica, ch_afec, ativa, ordem)
values""")

vals = []
todos_nomes = {}
for p in range(1,11):
    for i, (cod, nomes, cr, cht, teo, pra, afec, pre) in enumerate(M[p], start=1):
        _, nome = nomes.split("|")
        s = slug(nome)[:70]
        todos_nomes[nome] = s
        ativa = 'true' if nome in ATIVAS else 'false'
        vals.append(
            f"  ((select id from public.periodos where numero = {p}), {q(cod)}, {q(nome)}, {q(s)}, "
            f"{n(cr)}, {n(cht)}, {n(teo)}, {n(pra)}, {n(afec)}, {ativa}, {i})"
        )
out.append(",\n".join(vals) + "\non conflict (slug) do nothing;\n")

out.append("""-- ---------------------------------------------------------------------------
-- PRE-REQUISITOS
-- \"Vestibular\" na matriz significa ausencia de pre-requisito: nao vira linha.
-- ---------------------------------------------------------------------------
insert into public.materia_prerequisitos (materia_id, prerequisito_id)
select m.id, p.id from (values""")

pares = []
faltando = []
for p in range(1,11):
    for (cod, nomes, cr, cht, teo, pra, afec, pre) in M[p]:
        _, nome = nomes.split("|")
        for r in pre:
            if r not in todos_nomes:
                faltando.append((nome, r))
            pares.append(f"  ({q(todos_nomes[nome])}, {q(todos_nomes.get(r,''))})")

out.append(",\n".join(pares) + """
) as v(materia_slug, prereq_slug)
join public.materias m on m.slug = v.materia_slug
join public.materias p on p.slug = v.prereq_slug
on conflict do nothing;
""")

out.append("""-- ---------------------------------------------------------------------------
-- CONQUISTAS
-- Sem emoji. O desenho da medalha e feito em SVG na paleta da marca (S6).
-- ---------------------------------------------------------------------------
insert into public.conquistas (codigo, nome, descricao, criterio, ordem) values
  ('primeiro_simulado', 'Primeiro passo', 'Concluiu o primeiro simulado.',
   '{"tipo":"simulados_concluidos","valor":1}', 1),
  ('streak_3',   'Tres dias seguidos', 'Bateu o minimo diario por 3 dias seguidos.',
   '{"tipo":"streak_dias","valor":3}', 2),
  ('streak_7',   'Uma semana inteira', 'Bateu o minimo diario por 7 dias seguidos.',
   '{"tipo":"streak_dias","valor":7}', 3),
  ('streak_30',  'Um mes de constancia', 'Bateu o minimo diario por 30 dias seguidos.',
   '{"tipo":"streak_dias","valor":30}', 4),
  ('meta_semanal_1', 'Meta batida', 'Cumpriu a meta semanal de questoes uma vez.',
   '{"tipo":"metas_semanais","valor":1}', 5),
  ('meta_semanal_4', 'Mes no alvo', 'Cumpriu a meta semanal quatro semanas seguidas.',
   '{"tipo":"metas_semanais_seguidas","valor":4}', 6),
  ('questoes_100',  'Cem questoes', 'Respondeu 100 questoes.',
   '{"tipo":"questoes_respondidas","valor":100}', 7),
  ('questoes_500',  'Quinhentas questoes', 'Respondeu 500 questoes.',
   '{"tipo":"questoes_respondidas","valor":500}', 8),
  ('questoes_1000', 'Mil questoes', 'Respondeu 1000 questoes.',
   '{"tipo":"questoes_respondidas","valor":1000}', 9),
  ('acerto_80',  'Mira calibrada', 'Fechou um simulado de 30 questoes com 80% ou mais.',
   '{"tipo":"acerto_simulado","valor":80,"minimo_questoes":30}', 10),
  ('materia_dominada', 'Materia dominada', 'Atingiu 85% de acerto em uma materia com ao menos 100 questoes respondidas.',
   '{"tipo":"acerto_materia","valor":85,"minimo_questoes":100}', 11),
  ('virada_de_erro', 'Erro corrigido', 'Acertou 20 questoes que ja tinha errado antes.',
   '{"tipo":"erros_revertidos","valor":20}', 12)
on conflict (codigo) do nothing;
""")

open('/home/claude/estudevet-v11/supabase/seed.sql','w').write("\n".join(out))
print("materias:", sum(len(v) for v in M.values()))
print("prereqs:", len(pares))
print("prereq faltando:", faltando)
