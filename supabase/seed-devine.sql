-- Devine seed: foundational domains, program, requirements, and courses
-- Run after schema.sql in Supabase SQL editor.

begin;

-- Resolve a seed actor (first auth user)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
)
insert into domains (created_by, code, title, description, status)
select actor.user_id, seed.code, seed.title, seed.description, 'active'
from actor
cross join (values
  ('PHIL', 'Philosophy', 'Foundational philosophical formation.'),
  ('THEO', 'Catholic Theology', 'Dogmatic and fundamental theology.'),
  ('HIST', 'Church History', 'Historical development of the Church.'),
  ('SCRP', 'Scripture', 'Biblical foundations and interpretation.'),
  ('REL', 'Religious Studies / Comparative Religion', 'Comparative study of religious traditions.'),
  ('PATR', 'Patristics', 'Fathers of the Church and early theology.'),
  ('MORL', 'Moral Theology', 'Moral reasoning and virtue ethics.'),
  ('DOGM', 'Dogmatic Theology', 'Doctrinal foundations and articulation.'),
  ('SPIR', 'Spiritual Theology', 'Spiritual formation and tradition.'),
  ('LIT', 'Liturgy / Sacramental Theology', 'Liturgical theology and sacramental life.')
) as seed(code, title, description)
where not exists (
  select 1 from domains d where d.title = seed.title
);

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program_seed as (
  insert into programs (owner_id, title, description, is_active)
  select actor.user_id,
         'Devine College Core',
         'Foundational curriculum establishing philosophical, theological, and historical formation.',
         true
  from actor
  where not exists (
    select 1 from programs p where p.title = 'Devine College Core'
  )
  returning id
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into program_members (program_id, user_id, role)
select program.id, actor.user_id, 'owner'
from program
cross join actor
where not exists (
  select 1 from program_members pm
  where pm.program_id = program.id and pm.user_id = actor.user_id
);

update programs
set description = 'Phased formation in philosophy, theology, Scripture, and Church history leading into conciliar, ecclesial, and sacramental consolidation.'
where title = 'Devine College Core';

-- Set initial enrollment to PHIL 501 (the first foundation course).
update program_members
set current_course_id = (
  select c.id from courses c
  join programs p on p.id = c.program_id
  where c.code = 'PHIL 501' and p.title = 'Devine College Core'
  limit 1
)
where current_course_id is null
  and role = 'owner'
  and program_id = (select id from programs where title = 'Devine College Core' limit 1);

-- Ensure requirement block ordering remains unique before inserting new blocks
update requirement_blocks
set position = 7
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Research and Synthesis';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into requirement_blocks (
  program_id,
  title,
  description,
  category,
  minimum_courses_required,
  minimum_credits_required,
  position,
  created_by
)
select program.id,
       seed.title,
       seed.description,
       seed.category,
       seed.min_courses,
       seed.min_credits,
       seed.position,
       actor.user_id
from program
cross join actor
  cross join (values
    ('Foundations in Philosophy', 'Introductory philosophical formation in metaphysics and first principles.', 'Foundations', 1, 3, 0),
    ('Foundations in Catholic Theology', 'Fundamental theology and the act of faith.', 'Foundations', 1, 3, 1),
    ('Church History Core', 'Apostolic and patristic history with doctrinal consolidation.', 'Core', 2, 6, 2),
    ('Scripture Core', 'Scriptural foundations with ecclesial interpretation and direct biblical engagement.', 'Core', 1, 3, 3),
    ('Advanced Theology', 'Conciliar, ecclesial, and sacramental consolidation.', 'Advanced', 3, 9, 4),
    ('Moral Theology', 'Moral theology grounded in virtue, law, and conscience.', 'Core', 2, 6, 5),
    ('Spiritual Theology', 'Spiritual theology grounded in prayer, ascetical discipline, and growth in charity.', 'Advanced', 1, 3, 6),
      ('Research and Synthesis', 'Research method and capstone synthesis.', 'Capstone', 2, 6, 7)
  ) as seed(title, description, category, min_courses, min_credits, position)
where not exists (
  select 1 from requirement_blocks rb
  where rb.program_id = program.id and rb.title = seed.title
);

-- Constitutional alignment for requirement blocks (minimums and descriptions)
update requirement_blocks
set
  description = 'Introductory philosophical formation in metaphysics, reason, and first principles.',
  minimum_courses_required = 1,
  minimum_credits_required = 3
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Foundations in Philosophy';

update requirement_blocks
set
  description = 'Fundamental theology: revelation, faith, Scripture, and Tradition as sources of doctrine.',
  minimum_courses_required = 1,
  minimum_credits_required = 3
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Foundations in Catholic Theology';

update requirement_blocks
set
  description = 'Apostolic and patristic history with doctrinal consolidation in the early Church.',
  minimum_courses_required = 2,
  minimum_credits_required = 6
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Church History Core';

update requirement_blocks
set
  description = 'Scriptural foundations with ecclesial interpretation and direct biblical engagement.',
  minimum_courses_required = 1,
  minimum_credits_required = 3
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Scripture Core';

update requirement_blocks
set
  description = 'Conciliar, ecclesial, and sacramental consolidation forming the core of advanced theology.',
  minimum_courses_required = 3,
  minimum_credits_required = 9
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Advanced Theology';

update requirement_blocks
set
  description = 'Moral theology grounded in virtue, law, and conscience, completed in later phases.',
  minimum_courses_required = 2,
  minimum_credits_required = 6
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Moral Theology';

update requirement_blocks
set
  description = 'Spiritual theology grounded in prayer, ascetical discipline, and growth in charity.',
  minimum_courses_required = 1,
  minimum_credits_required = 3,
  position = 6
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Spiritual Theology';

update requirement_blocks
  set
    description = 'Research method and capstone synthesis integrating philosophy, theology, Scripture, and history.',
    minimum_courses_required = 2,
    minimum_credits_required = 6,
    position = 7
where program_id = (select id from programs where title = 'Devine College Core' limit 1)
  and title = 'Research and Synthesis';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
phi_domain as (
  select id from domains where title = 'Philosophy' limit 1
),
theo_domain as (
  select id from domains where title = 'Catholic Theology' limit 1
),
hist_domain as (
  select id from domains where title = 'Church History' limit 1
),
scrp_domain as (
  select id from domains where title = 'Scripture' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select program.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from program
cross join actor
cross join (
  values
    (
      'PHIL 501',
      'Foundations of Philosophy',
      'A disciplined introduction to philosophical reasoning, metaphysics, and natural theology in preparation for fundamental theology.',
      'Philosophy',
      3,
      'Foundational',
      'Define the philosophical act and its relation to truth; analyze being, essence, and first principles in classical sources; construct a basic natural-theological account of first cause; explain how reason prepares for faith via the preambles of faith.',
      'Unit 1: The philosophical act and the pursuit of wisdom.\nUnit 2: Being, essence, and first principles.\nUnit 3: Natural theology and first cause.\nUnit 4: Reason and the preambles of faith.\nAssessment: three essays and one analysis grounded in primary texts.',
      (select id from phi_domain)
    ),
    (
      'THEO 510',
      'Fundamental Theology',
      'Fundamental theology grounded in revelation, faith, and the sources of Catholic doctrine; builds on philosophical foundations.',
      'Catholic Theology',
      3,
      'Foundational',
      'Explain Catholic doctrine of revelation and faith; distinguish Scripture and Tradition as sources of theology; evaluate patristic witness to the rule of faith; articulate the Magisterium''s role and a disciplined theological method.',
      'Unit 1: Revelation and the act of faith (Dei Verbum, Dei Filius, CCC).\nUnit 2: Scripture, Tradition, and the rule of faith (Dei Verbum 7-16, Irenaeus).\nUnit 3: Magisterium and theological method (Dei Verbum 10, Lumen Gentium 25, Donum Veritatis).\nAssessment: three written analyses with doctrinal precision.',
      (select id from theo_domain)
    ),
    (
      'HIST 520',
      'Early Church History',
      'Historical formation from apostolic origins through late patristic consolidation, with attention to councils and doctrinal development.',
      'Church History',
      3,
      'Foundational',
      'Describe apostolic foundations and early ecclesial order; interpret patristic and conciliar sources historically; analyze persecution and imperial transition; assess Augustine''s role in late patristic doctrinal consolidation.',
      'Unit 1: Apostolic foundations and early communities.\nUnit 2: Councils, creeds, and patristic synthesis.\nUnit 3: Persecution, martyrdom, and the imperial turn.\nUnit 4: Augustine and late patristic consolidation.\nAssessment: four source analyses grounded in primary texts.',
      (select id from hist_domain)
    ),
    (
      'SCRP 530',
      'Foundations of Scripture',
      'Foundational Scripture course integrating Catholic doctrine of revelation with ecclesial reading and direct exegesis of John.',
      'Scripture',
      3,
      'Foundational',
      'Explain Catholic teaching on inspiration and revelation; articulate canonical and interpretive principles; apply the literal and spiritual senses; perform close reading of Johannine texts with patristic guidance.',
      'Unit 1: Revelation and inspiration (Dei Verbum 17-20; Providentissimus Deus).\nUnit 2: Canon and ecclesial interpretation (Dei Verbum 21-26; Divino Afflante Spiritu; PBC).\nUnit 3: Senses of Scripture in the Church (Augustine, Origen, CCC 115-119).\nUnit 4: Gospel foundations in John (John 1-6; 13-17; Augustine Tractates).\nAssessment: doctrinal essays, method memo, and one exegetical close reading.',
      (select id from scrp_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = program.id and c.code = seed.code
);

  update courses
  set
    description = 'A disciplined introduction to philosophical reasoning, being, and natural theology that anchors the foundations sequence and prepares the act of faith for fundamental theology.',
  learning_outcomes = 'Define the philosophical act and its relation to truth; analyze being, essence, and first principles in classical sources; construct a basic natural-theological account of first cause; explain how reason prepares for faith via the preambles of faith.',
  syllabus = 'Unit 1: The philosophical act and the pursuit of wisdom.\nUnit 2: Being, essence, and first principles.\nUnit 3: Natural theology and first cause.\nUnit 4: Reason and the preambles of faith.\nAssessment: three essays and one analysis grounded in primary texts.'
where code = 'PHIL 501';

  update courses
  set
    description = 'Fundamental theology grounded in revelation and faith, ordering Scripture, Tradition, and Magisterium; builds on philosophical foundations and prepares the ecclesial and conciliar sequence.',
    learning_outcomes = 'Explain Catholic doctrine of revelation and faith; distinguish Scripture and Tradition as sources of theology; evaluate patristic witness to the rule of faith; articulate the Magisterium''s role and a disciplined theological method; analyze the act of faith as both reasonable and supernatural in light of Aquinas and magisterial teaching.',
    syllabus = 'Unit 1: Revelation and the act of faith (Dei Verbum, Dei Filius, CCC).\nUnit 2: Scripture, Tradition, and the rule of faith (Dei Verbum 7-16, Irenaeus).\nUnit 3: Magisterium and theological method (Dei Verbum 10, Lumen Gentium 25, Donum Veritatis).\nUnit 4: The act of faith and the obedience of reason (Aquinas II-II q.1-2; Dei Filius ch. 3; CCC 142-175).\nAssessment: one doctrinal reflection, one exegesis, one magisterial-method analysis, and one synthesis essay grounded in primary texts.'
where code = 'THEO 510';

  update courses
  set
    description = 'Historical formation from apostolic origins through late patristic consolidation, establishing the patristic baseline for conciliar and ecclesial theology.',
  learning_outcomes = 'Describe apostolic foundations and early ecclesial order; interpret patristic and conciliar sources historically; analyze persecution and imperial transition; assess Augustine''s role in late patristic doctrinal consolidation.',
  syllabus = 'Unit 1: Apostolic foundations and early communities.\nUnit 2: Councils, creeds, and patristic synthesis.\nUnit 3: Persecution, martyrdom, and the imperial turn.\nUnit 4: Augustine and late patristic consolidation.\nAssessment: four source analyses grounded in primary texts.'
where code = 'HIST 520';

  update courses
  set
    description = 'Foundational Scripture course integrating Catholic doctrine of revelation with ecclesial reading and Johannine exegesis, establishing the canonical-method baseline for later Scripture specialization.',
  learning_outcomes = 'Explain Catholic teaching on inspiration and revelation; articulate canonical and interpretive principles; apply the literal and spiritual senses; perform close reading of Johannine texts with patristic guidance.',
    syllabus = 'Unit 1: Revelation and inspiration (Dei Verbum 17-20; Providentissimus Deus).\nUnit 2: Canon and ecclesial interpretation (Dei Verbum 21-26; Divino Afflante Spiritu; PBC).\nUnit 3: Senses of Scripture in the Church (Augustine, Origen, CCC 115-119).\nUnit 4: Gospel foundations in John (John 1-6; 13-17; Augustine Tractates).\nAssessment: one doctrinal essay, two interpretive/method memos, and one Johannine exegetical close reading.'
where code = 'SCRP 530';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
phil as (
  select id from courses where code = 'PHIL 501' limit 1
),
theo as (
  select id from courses where code = 'THEO 510' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select theo.id, phil.id, actor.user_id
from actor
cross join phil
cross join theo
where not exists (
  select 1 from course_prerequisites cp
  where cp.course_id = theo.id and cp.prerequisite_course_id = phil.id
);

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
theo as (
  select id from courses where code = 'THEO 510' limit 1
),
scrp as (
  select id from courses where code = 'SCRP 530' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select scrp.id, theo.id, actor.user_id
from actor
cross join theo
cross join scrp
where not exists (
  select 1 from course_prerequisites cp
  where cp.course_id = scrp.id and cp.prerequisite_course_id = theo.id
);

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and (
    (c.code = 'PHIL 501' and rb.title = 'Foundations in Philosophy') or
    (c.code = 'THEO 510' and rb.title = 'Foundations in Catholic Theology') or
    (c.code = 'HIST 520' and rb.title = 'Church History Core') or
    (c.code = 'SCRP 530' and rb.title = 'Scripture Core')
  )
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

-- Phase II: Ecclesial and conciliar consolidation (post-foundations)
-- Remove provisional second-tier courses from earlier drafts to prevent audit ambiguity.
delete from courses
where code in ('PATR 601', 'DOGM 610', 'MORL 620');

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
patr_domain as (
  select id from domains where title = 'Patristics' limit 1
),
dogm_domain as (
  select id from domains where title = 'Dogmatic Theology' limit 1
),
theo_domain as (
  select id from domains where title = 'Catholic Theology' limit 1
),
lit_domain as (
  select id from domains where title = 'Liturgy / Sacramental Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select program.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from program
cross join actor
cross join (
  values
    (
      'PATR 610',
      'Patristic Foundations: Rule of Faith and Early Doctrine',
      'Apostolic and early patristic sources that establish the rule of faith, ecclesial order, and the defense of doctrine.',
      'Patristics',
      3,
      'Intermediate',
      'Interpret apostolic-father texts on ecclesial order and worship; explain the rule of faith as a doctrinal norm; analyze early responses to gnosticism and pagan critique; evaluate patristic approaches to Scripture and tradition.',
      'Unit 1: Apostolic Fathers and early church order (Didache, Ignatius).\nUnit 2: Rule of faith and the gnostic challenge (Irenaeus).\nUnit 3: Apologists and the defense of Christian worship (Justin, Athenagoras).\nUnit 4: Tradition and scriptural interpretation in the early Fathers (Tertullian, Origen).\nAssessment: four source analyses grounded in primary texts.',
      (select id from patr_domain)
    ),
    (
      'CONC 620',
      'Conciliar Theology: Nicaea to Chalcedon',
      'Ecumenical councils and creeds from Nicaea through Chalcedon, with attention to doctrinal definition and controversy.',
      'Dogmatic Theology',
      3,
      'Intermediate',
      'Explain the doctrinal stakes of Nicaea, Constantinople, Ephesus, and Chalcedon; interpret conciliar texts and creeds; relate conciliar definitions to scriptural and patristic sources; articulate the Christological settlement with precision.',
      'Unit 1: Nicaea and the homoousios.\nUnit 2: Constantinople and the confession of the Spirit.\nUnit 3: Ephesus and the Theotokos.\nUnit 4: Chalcedon and the definition of two natures.\nAssessment: four conciliar analyses grounded in primary documents.',
      (select id from dogm_domain)
    ),
    (
      'ECCL 630',
      'Ecclesiology and Magisterium',
      'Catholic doctrine of the Church, apostolic authority, and the magisterial preservation of truth in Tradition.',
      'Catholic Theology',
      3,
      'Intermediate',
      'Articulate biblical and patristic images of the Church; explain apostolic succession and episcopal authority; analyze magisterial teaching on authority and infallibility; evaluate the development of doctrine within Tradition.',
      'Unit 1: Biblical and patristic images of the Church.\nUnit 2: Apostolic succession and episcopal authority.\nUnit 3: Magisterium and infallibility (Pastor Aeternus, Lumen Gentium 25).\nUnit 4: Tradition and development of doctrine (Dei Verbum 7-10; Newman).\nAssessment: three analyses and one theological essay.',
      (select id from theo_domain)
    ),
    (
      'LIT 640',
      'Sacramental Theology: Baptism and Eucharist',
      'Sacramental economy with focused study of baptism and Eucharist in Scripture, patristic witness, and magisterial definition.',
      'Liturgy / Sacramental Theology',
      3,
      'Intermediate',
      'Explain the sacramental economy; exegete baptismal and Eucharistic texts; analyze Trent and Vatican II on sacramental doctrine; articulate Eucharistic teaching with doctrinal precision.',
      'Unit 1: Sacramental economy and signs (Sacrosanctum Concilium; CCC).\nUnit 2: Baptism: initiation and regeneration (John 3; Rom 6; Trent).\nUnit 3: Eucharist: real presence and sacrifice (John 6; 1 Cor 11; Trent).\nUnit 4: Liturgy and participation (Sacrosanctum Concilium 14-20; patristic witness).\nAssessment: one exegesis and three doctrinal analyses.',
      (select id from lit_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = program.id and c.code = seed.code
);

update courses
set
  description = 'Apostolic and early patristic sources that establish the rule of faith, ecclesial order, and the defense of doctrine.',
  learning_outcomes = 'Interpret apostolic-father texts on ecclesial order and worship; explain the rule of faith as a doctrinal norm; analyze early responses to gnosticism and pagan critique; evaluate patristic approaches to Scripture and tradition.',
  syllabus = 'Unit 1: Apostolic Fathers and early church order (Didache, Ignatius).\nUnit 2: Rule of faith and the gnostic challenge (Irenaeus).\nUnit 3: Apologists and the defense of Christian worship (Justin, Athenagoras).\nUnit 4: Tradition and scriptural interpretation in the early Fathers (Tertullian, Origen).\nAssessment: four source analyses grounded in primary texts.'
where code = 'PATR 610';

update courses
set
  description = 'Ecumenical councils and creeds from Nicaea through Chalcedon, with attention to doctrinal definition and controversy.',
  learning_outcomes = 'Explain the doctrinal stakes of Nicaea, Constantinople, Ephesus, and Chalcedon; interpret conciliar texts and creeds; relate conciliar definitions to scriptural and patristic sources; articulate the Christological settlement with precision.',
  syllabus = 'Unit 1: Nicaea and the homoousios.\nUnit 2: Constantinople and the confession of the Spirit.\nUnit 3: Ephesus and the Theotokos.\nUnit 4: Chalcedon and the definition of two natures.\nAssessment: four conciliar analyses grounded in primary documents.'
where code = 'CONC 620';

update courses
set
  description = 'Catholic doctrine of the Church, apostolic authority, and the magisterial preservation of truth in Tradition.',
  learning_outcomes = 'Articulate biblical and patristic images of the Church; explain apostolic succession and episcopal authority; analyze magisterial teaching on authority and infallibility; evaluate the development of doctrine within Tradition.',
  syllabus = 'Unit 1: Biblical and patristic images of the Church.\nUnit 2: Apostolic succession and episcopal authority.\nUnit 3: Magisterium and infallibility (Pastor Aeternus, Lumen Gentium 25).\nUnit 4: Tradition and development of doctrine (Dei Verbum 7-10; Newman).\nAssessment: three analyses and one theological essay.'
where code = 'ECCL 630';

update courses
set
  description = 'Sacramental economy with focused study of baptism and Eucharist in Scripture, patristic witness, and magisterial definition.',
  learning_outcomes = 'Explain the sacramental economy; exegete baptismal and Eucharistic texts; analyze Trent and Vatican II on sacramental doctrine; articulate Eucharistic teaching with doctrinal precision.',
  syllabus = 'Unit 1: Sacramental economy and signs (Sacrosanctum Concilium; CCC).\nUnit 2: Baptism: initiation and regeneration (John 3; Rom 6; Trent).\nUnit 3: Eucharist: real presence and sacrifice (John 6; 1 Cor 11; Trent).\nUnit 4: Liturgy and participation (Sacrosanctum Concilium 14-20; patristic witness).\nAssessment: one exegesis and three doctrinal analyses.'
where code = 'LIT 640';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and (
    (c.code = 'PATR 610' and rb.title = 'Church History Core') or
    (c.code = 'CONC 620' and rb.title = 'Advanced Theology') or
    (c.code = 'ECCL 630' and rb.title = 'Advanced Theology') or
    (c.code = 'LIT 640' and rb.title = 'Advanced Theology')
  )
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
patr as (
  select id from courses where code = 'PATR 610' limit 1
),
conc as (
  select id from courses where code = 'CONC 620' limit 1
),
eccl as (
  select id from courses where code = 'ECCL 630' limit 1
),
lit as (
  select id from courses where code = 'LIT 640' limit 1
),
theo as (
  select id from courses where code = 'THEO 510' limit 1
),
hist as (
  select id from courses where code = 'HIST 520' limit 1
),
scrp as (
  select id from courses where code = 'SCRP 530' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from patr), (select id from theo)),
    ((select id from patr), (select id from hist)),
    ((select id from conc), (select id from patr)),
    ((select id from eccl), (select id from conc)),
    ((select id from eccl), (select id from theo)),
    ((select id from lit), (select id from eccl)),
    ((select id from lit), (select id from scrp))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Phase III: Moral Theology initiation (first course)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
morl_domain as (
  select id from domains where title = 'Moral Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'MORL 710',
      'Moral Theology: Beatitude, Law, and the Moral Act',
      'Moral theology grounded in the final end, the moral act, and the natural law, preparing for later virtue and moral formation studies.',
      'Moral Theology',
      3,
      'Advanced',
      'Explain the final end and beatitude as the horizon of moral life; analyze the structure of the moral act and human freedom; articulate natural law and conscience in Thomistic and magisterial sources; distinguish the New Law and its relation to grace.',
      'Unit 1: Final end and beatitude (Aquinas I-II 1-5; CCC 1716-1729).
Unit 2: The moral act and human freedom (Aquinas I-II 6-17; CCC 1730-1748).
Unit 3: Natural law and conscience (Aquinas I-II 90-94; Veritatis Splendor 54-64).
Unit 4: The New Law and grace (Aquinas I-II 106-108; CCC 1965-1974).
Assessment: four analytic essays grounded in primary texts.',
      (select id from morl_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Moral theology grounded in the final end, the moral act, and the natural law, preparing for later virtue and moral formation studies.',
  learning_outcomes = 'Explain the final end and beatitude as the horizon of moral life; analyze the structure of the moral act and human freedom; articulate natural law and conscience in Thomistic and magisterial sources; distinguish the New Law and its relation to grace.',
  syllabus = 'Unit 1: Final end and beatitude (Aquinas I-II 1-5; CCC 1716-1729).
Unit 2: The moral act and human freedom (Aquinas I-II 6-17; CCC 1730-1748).
Unit 3: Natural law and conscience (Aquinas I-II 90-94; Veritatis Splendor 54-64).
Unit 4: The New Law and grace (Aquinas I-II 106-108; CCC 1965-1974).
Assessment: four analytic essays grounded in primary texts.'
where code = 'MORL 710';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'MORL 710'
  and rb.title = 'Moral Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
morl as (
  select id from courses where code = 'MORL 710' limit 1
),
phil as (
  select id from courses where code = 'PHIL 501' limit 1
),
eccl as (
  select id from courses where code = 'ECCL 630' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from morl), (select id from phil)),
    ((select id from morl), (select id from eccl))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for MORL 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'MORL 710' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Final End and Beatitude', 'The final end and beatitude as the horizon of moral life.', 0),
  ('The Moral Act and Human Freedom', 'Voluntariness, intention, and the structure of moral action.', 1),
  ('Natural Law and Conscience', 'Natural law, practical reason, and the formation of conscience.', 2),
  ('The New Law and Grace', 'The law of Christ and its relation to grace.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for MORL 710 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'Final End and Beatitude'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'The Moral Act and Human Freedom'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'Natural Law and Conscience'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'The New Law and Grace'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Summa Theologiae I-II, q.1-5 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.1-5', 2, 'Aquinas, Summa Theologiae I-II, q.1-5.', 0),
    ((select id from module_1), 'Catechism of the Catholic Church 1716-1729', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1716-1729', 1, 'Catechism of the Catholic Church, 1716-1729.', 1),
    ((select id from module_2), 'Summa Theologiae I-II, q.6-17 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.6-17', 2, 'Aquinas, Summa Theologiae I-II, q.6-17.', 0),
    ((select id from module_2), 'Catechism of the Catholic Church 1730-1748', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1730-1748', 1, 'Catechism of the Catholic Church, 1730-1748.', 1),
    ((select id from module_3), 'Summa Theologiae I-II, q.90-94 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.90-94', 2, 'Aquinas, Summa Theologiae I-II, q.90-94.', 0),
    ((select id from module_3), 'Veritatis Splendor 54-64', 'John Paul II', 'Magisterial text', 'Primary', 'Modern', 'VS 54-64', 1, 'John Paul II, Veritatis Splendor, 54-64.', 1),
    ((select id from module_4), 'Summa Theologiae I-II, q.106-108 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.106-108', 2, 'Aquinas, Summa Theologiae I-II, q.106-108.', 0),
    ((select id from module_4), 'Catechism of the Catholic Church 1965-1974', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1965-1974', 1, 'Catechism of the Catholic Church, 1965-1974.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for MORL 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'Final End and Beatitude'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'The Moral Act and Human Freedom'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'Natural Law and Conscience'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 710'
    and m.title = 'The New Law and Grace'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Final End and Beatitude', 'Write 900-1200 words explaining the final end and beatitude using Aquinas I-II q.1-5 and CCC 1716-1729.', 'analysis'),
    ((select id from module_2), 'Analysis: The Moral Act and Freedom', 'Write 900-1200 words analyzing voluntariness, intention, and freedom using Aquinas I-II q.6-17 and CCC 1730-1748.', 'analysis'),
    ((select id from module_3), 'Analysis: Natural Law and Conscience', 'Write 900-1200 words articulating natural law and conscience using Aquinas I-II q.90-94 and Veritatis Splendor 54-64.', 'analysis'),
    ((select id from module_4), 'Essay: The New Law and Grace', 'Write 900-1200 words explaining the New Law and its relation to grace using Aquinas I-II q.106-108 and CCC 1965-1974.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Moral Theology completion (second course)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
morl_domain as (
  select id from domains where title = 'Moral Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'MORL 720',
      'Moral Theology: Virtue, Passion, and Prudence',
      'Moral theology focused on virtue, passions, prudence, and the formation of moral character, completing the foundational moral sequence.',
      'Moral Theology',
      3,
      'Advanced',
      'Distinguish habits and virtues in the classical tradition; analyze the passions and their moral ordering; explain prudence and practical reason in moral judgment; assess vice and sin as distortions of moral formation.',
      'Unit 1: Habits and virtues (Aquinas I-II 49-67; Aristotle Ethics II).
Unit 2: Passions and moral psychology (Aquinas I-II 22-48; CCC 1762-1775).
Unit 3: Prudence and practical reasoning (Aquinas II-II 47-56; CCC 1806, 1835).
Unit 4: Vice, sin, and moral formation (Aquinas I-II 71-89; CCC 1846-1876).
Assessment: three analyses and one synthetic essay grounded in primary texts.',
      (select id from morl_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Moral theology focused on virtue, passions, prudence, and the formation of moral character, completing the foundational moral sequence.',
  learning_outcomes = 'Distinguish habits and virtues in the classical tradition; analyze the passions and their moral ordering; explain prudence and practical reason in moral judgment; assess vice and sin as distortions of moral formation.',
  syllabus = 'Unit 1: Habits and virtues (Aquinas I-II 49-67; Aristotle Ethics II).
Unit 2: Passions and moral psychology (Aquinas I-II 22-48; CCC 1762-1775).
Unit 3: Prudence and practical reasoning (Aquinas II-II 47-56; CCC 1806, 1835).
Unit 4: Vice, sin, and moral formation (Aquinas I-II 71-89; CCC 1846-1876).
Assessment: three analyses and one synthetic essay grounded in primary texts.'
where code = 'MORL 720';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'MORL 720'
  and rb.title = 'Moral Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
morl as (
  select id from courses where code = 'MORL 720' limit 1
),
prior as (
  select id from courses where code = 'MORL 710' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from morl), (select id from prior))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for MORL 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'MORL 720' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Habits and Virtues', 'Habits, virtues, and the formation of moral character.', 0),
  ('Passions and Moral Psychology', 'Passions and their ordering within the moral life.', 1),
  ('Prudence and Practical Reason', 'Prudence as the principal virtue of moral judgment.', 2),
  ('Vice, Sin, and Moral Formation', 'Vice and sin as distortions of moral formation.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for MORL 720 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Habits and Virtues'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Passions and Moral Psychology'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Prudence and Practical Reason'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Vice, Sin, and Moral Formation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Summa Theologiae I-II, q.49-67 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.49-67', 2, 'Aquinas, Summa Theologiae I-II, q.49-67.', 0),
    ((select id from module_1), 'Nicomachean Ethics II (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Book II', 1.5, 'Aristotle, Nicomachean Ethics, Book II.', 1),
    ((select id from module_2), 'Summa Theologiae I-II, q.22-48 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.22-48', 2, 'Aquinas, Summa Theologiae I-II, q.22-48.', 0),
    ((select id from module_2), 'Catechism of the Catholic Church 1762-1775', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1762-1775', 1, 'Catechism of the Catholic Church, 1762-1775.', 1),
    ((select id from module_3), 'Summa Theologiae II-II, q.47-56 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'II-II q.47-56', 2, 'Aquinas, Summa Theologiae II-II, q.47-56.', 0),
    ((select id from module_3), 'Catechism of the Catholic Church 1806 and 1835', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1806; 1835', 1, 'Catechism of the Catholic Church, 1806 and 1835.', 1),
    ((select id from module_4), 'Summa Theologiae I-II, q.71-89 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.71-89', 2, 'Aquinas, Summa Theologiae I-II, q.71-89.', 0),
    ((select id from module_4), 'Catechism of the Catholic Church 1846-1876', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1846-1876', 1.5, 'Catechism of the Catholic Church, 1846-1876.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for MORL 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Habits and Virtues'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Passions and Moral Psychology'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Prudence and Practical Reason'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'MORL 720'
    and m.title = 'Vice, Sin, and Moral Formation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Habits and Virtues', 'Write 900-1200 words analyzing habits and virtues using Aquinas I-II q.49-67 and Aristotle Ethics II.', 'analysis'),
    ((select id from module_2), 'Analysis: Passions and Moral Psychology', 'Write 900-1200 words explaining the passions and their moral ordering using Aquinas I-II q.22-48 and CCC 1762-1775.', 'analysis'),
    ((select id from module_3), 'Analysis: Prudence and Practical Reason', 'Write 900-1200 words analyzing prudence using Aquinas II-II q.47-56 and CCC 1806, 1835.', 'analysis'),
    ((select id from module_4), 'Essay: Vice, Sin, and Moral Formation', 'Write 900-1200 words assessing vice and sin as distortions of moral formation using Aquinas I-II q.71-89 and CCC 1846-1876.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Advanced Dogmatics initiation (first course)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
dogm_domain as (
  select id from domains where title = 'Dogmatic Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'DOGM 710',
      'Dogmatic Theology: Theological Anthropology and Grace',
      'Dogmatic theology of the human person, original sin, and the gift of grace in the economy of salvation.',
      'Dogmatic Theology',
      3,
      'Advanced',
      'Explain creation and the imago Dei as the foundation of theological anthropology; analyze original sin in patristic and conciliar sources; articulate justification and the priority of grace; describe deification as participation in divine life.',
      'Unit 1: Creation and the imago Dei (Genesis 1-3; CCC 355-384).
Unit 2: Original sin and the fall (Trent, Session 5; Augustine, On Nature and Grace).
Unit 3: Justification and the gift of grace (Trent, Session 6; Aquinas I-II 109-114).
Unit 4: Deification and participation in divine life (2 Peter 1:4; Athanasius, On the Incarnation 54).
Assessment: three analyses and one synthetic essay grounded in primary texts.',
      (select id from dogm_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Dogmatic theology of the human person, original sin, and the gift of grace in the economy of salvation.',
  learning_outcomes = 'Explain creation and the imago Dei as the foundation of theological anthropology; analyze original sin in patristic and conciliar sources; articulate justification and the priority of grace; describe deification as participation in divine life.',
  syllabus = 'Unit 1: Creation and the imago Dei (Genesis 1-3; CCC 355-384).
Unit 2: Original sin and the fall (Trent, Session 5; Augustine, On Nature and Grace).
Unit 3: Justification and the gift of grace (Trent, Session 6; Aquinas I-II 109-114).
Unit 4: Deification and participation in divine life (2 Peter 1:4; Athanasius, On the Incarnation 54).
Assessment: three analyses and one synthetic essay grounded in primary texts.'
where code = 'DOGM 710';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'DOGM 710'
  and rb.title = 'Advanced Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
dogm as (
  select id from courses where code = 'DOGM 710' limit 1
),
eccl as (
  select id from courses where code = 'ECCL 630' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from dogm), (select id from eccl))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for DOGM 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'DOGM 710' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Creation and the Imago Dei', 'Creation and the divine image as the foundation of theological anthropology.', 0),
  ('Original Sin and the Fall', 'Original sin and its consequences in patristic and conciliar sources.', 1),
  ('Justification and the Gift of Grace', 'Justification and the priority of grace in the economy of salvation.', 2),
  ('Deification and Participation', 'Participation in divine life and the meaning of deification.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for DOGM 710 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Creation and the Imago Dei'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Original Sin and the Fall'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Justification and the Gift of Grace'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Deification and Participation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Genesis 1-3 (selections)', 'The Book of Genesis', 'Scripture', 'Primary', 'Apostolic', 'Gen 1-3', 1.5, 'Genesis 1-3.', 0),
    ((select id from module_1), 'Catechism of the Catholic Church 355-384', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 355-384', 1.5, 'Catechism of the Catholic Church, 355-384.', 1),
    ((select id from module_2), 'Council of Trent, Session 5: Decree on Original Sin', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 5', 1.5, 'Council of Trent, Session 5: Decree on Original Sin.', 0),
    ((select id from module_2), 'On Nature and Grace (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'Augustine, On Nature and Grace, selections.', 1),
    ((select id from module_3), 'Council of Trent, Session 6: Decree on Justification (selections)', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 6', 1.5, 'Council of Trent, Session 6: Decree on Justification.', 0),
    ((select id from module_3), 'Summa Theologiae I-II, q.109-114 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'I-II q.109-114', 2, 'Aquinas, Summa Theologiae I-II, q.109-114.', 1),
    ((select id from module_4), '2 Peter 1:4', 'The Second Letter of Peter', 'Scripture', 'Primary', 'Apostolic', '2 Pet 1:4', 0.5, '2 Peter 1:4.', 0),
    ((select id from module_4), 'On the Incarnation 54 (selections)', 'Athanasius of Alexandria', 'Patristic text', 'Primary', 'Patristic', 'Ch. 54', 1.5, 'Athanasius, On the Incarnation, ch. 54.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for DOGM 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Creation and the Imago Dei'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Original Sin and the Fall'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Justification and the Gift of Grace'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 710'
    and m.title = 'Deification and Participation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Creation and the Imago Dei', 'Write 900-1200 words explaining the imago Dei using Genesis 1-3 and CCC 355-384.', 'analysis'),
    ((select id from module_2), 'Analysis: Original Sin', 'Write 900-1200 words analyzing original sin using Trent Session 5 and Augustine''s On Nature and Grace.', 'analysis'),
    ((select id from module_3), 'Analysis: Justification and Grace', 'Write 900-1200 words explaining justification using Trent Session 6 and Aquinas I-II q.109-114.', 'analysis'),
    ((select id from module_4), 'Essay: Deification and Participation', 'Write 900-1200 words assessing participation in divine life using 2 Peter 1:4 and Athanasius On the Incarnation 54.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Spiritual Theology initiation (first course)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
spir_domain as (
  select id from domains where title = 'Spiritual Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'SPIR 710',
      'Spiritual Theology: Prayer, Asceticism, and Growth in Charity',
      'Foundational spiritual theology centered on the universal call to holiness, the discipline of prayer, ascetical purification, and growth in charity within ecclesial life.',
      'Spiritual Theology',
      3,
      'Advanced',
      'Articulate the universal call to holiness and the primacy of charity; explain Catholic teaching on prayer as communion with God; analyze ascetical purification and discipline in patristic and monastic sources; integrate spiritual growth with ecclesial and sacramental life without reducing it to moral casuistry.',
      'Unit 1: Universal call to holiness and charity (Lumen Gentium 39-42; 1 Corinthians 13).
Unit 2: Prayer as communion with God (CCC 2558-2758; Augustine, Letter 130).
Unit 3: Ascetical purification and discipline (Cassian, Conference 1; Rule of St. Benedict, ch. 7).
Unit 4: Growth in charity and the devout life (Bernard, On Loving God 1-7; Francis de Sales, Introduction to the Devout Life I).
Assessment: three analyses and one synthetic essay grounded in primary texts.',
      (select id from spir_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Foundational spiritual theology centered on the universal call to holiness, the discipline of prayer, ascetical purification, and growth in charity within ecclesial life.',
  learning_outcomes = 'Articulate the universal call to holiness and the primacy of charity; explain Catholic teaching on prayer as communion with God; analyze ascetical purification and discipline in patristic and monastic sources; integrate spiritual growth with ecclesial and sacramental life without reducing it to moral casuistry.',
  syllabus = 'Unit 1: Universal call to holiness and charity (Lumen Gentium 39-42; 1 Corinthians 13).
Unit 2: Prayer as communion with God (CCC 2558-2758; Augustine, Letter 130).
Unit 3: Ascetical purification and discipline (Cassian, Conference 1; Rule of St. Benedict, ch. 7).
Unit 4: Growth in charity and the devout life (Bernard, On Loving God 1-7; Francis de Sales, Introduction to the Devout Life I).
Assessment: three analyses and one synthetic essay grounded in primary texts.'
where code = 'SPIR 710';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'SPIR 710'
  and rb.title = 'Spiritual Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
spir as (
  select id from courses where code = 'SPIR 710' limit 1
),
morl as (
  select id from courses where code = 'MORL 710' limit 1
),
eccl as (
  select id from courses where code = 'ECCL 630' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from spir), (select id from morl)),
    ((select id from spir), (select id from eccl))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for SPIR 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'SPIR 710' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Universal Call to Holiness and Charity', 'Vatican II and Scripture on holiness and charity as the goal of Christian life.', 0),
  ('Prayer as Communion with God', 'Prayer as communion with God and the school of the spiritual life.', 1),
  ('Ascetical Purification and Discipline', 'Purification, detachment, and discipline in the early monastic tradition.', 2),
  ('Growth in Charity and the Devout Life', 'Growth in charity and stability of the spiritual life in classical sources.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for SPIR 710 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Universal Call to Holiness and Charity'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Prayer as Communion with God'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Ascetical Purification and Discipline'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Growth in Charity and the Devout Life'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Lumen Gentium 39-42', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'LG 39-42', 1, 'Second Vatican Council, Lumen Gentium 39-42.', 0),
    ((select id from module_1), '1 Corinthians 13', 'The First Letter to the Corinthians', 'Scripture', 'Primary', 'Apostolic', '1 Cor 13', 1, '1 Corinthians 13.', 1),
    ((select id from module_2), 'Catechism of the Catholic Church 2558-2758 (selections)', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 2558-2758', 2, 'Catechism of the Catholic Church, 2558-2758.', 0),
    ((select id from module_2), 'Letter 130 to Proba (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'Augustine, Letter 130 to Proba.', 1),
    ((select id from module_3), 'Conference 1: The Goal of the Monk (selections)', 'John Cassian', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'John Cassian, Conference 1.', 0),
    ((select id from module_3), 'Rule of St. Benedict, ch. 7 (selections)', 'Benedict of Nursia', 'Monastic text', 'Primary', 'Medieval', 'Ch. 7', 1, 'Rule of St. Benedict, ch. 7.', 1),
    ((select id from module_4), 'On Loving God 1-7 (selections)', 'Bernard of Clairvaux', 'Primary text', 'Primary', 'Medieval', 'Ch. 1-7', 1.5, 'Bernard of Clairvaux, On Loving God, ch. 1-7.', 0),
    ((select id from module_4), 'Introduction to the Devout Life, Part I (selections)', 'Francis de Sales', 'Primary text', 'Primary', 'Modern', 'Part I', 1.5, 'Francis de Sales, Introduction to the Devout Life, Part I.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for SPIR 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Universal Call to Holiness and Charity'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Prayer as Communion with God'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Ascetical Purification and Discipline'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 710'
    and m.title = 'Growth in Charity and the Devout Life'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Universal Call to Holiness', 'Write 900-1200 words analyzing the universal call to holiness and charity using Lumen Gentium 39-42 and 1 Corinthians 13.', 'analysis'),
    ((select id from module_2), 'Analysis: Prayer as Communion', 'Write 900-1200 words explaining prayer as communion with God using CCC 2558-2758 and Augustine''s Letter 130.', 'analysis'),
    ((select id from module_3), 'Analysis: Ascetical Purification', 'Write 900-1200 words analyzing ascetical purification using John Cassian''s Conference 1 and the Rule of St. Benedict, ch. 7.', 'analysis'),
    ((select id from module_4), 'Essay: Growth in Charity and the Devout Life', 'Write 900-1200 words synthesizing growth in charity using Bernard''s On Loving God 1-7 and Francis de Sales'' Introduction to the Devout Life, Part I.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
  where module_id is not null
    and not exists (
      select 1 from assignments a
      where a.module_id = seed.module_id and a.title = seed.title
    );

-- RSYN 720 - Senior Thesis / Integrated Synthesis
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
theo_domain as (
  select id from domains where title = 'Catholic Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  code,
  title,
  description,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select
  programs.id,
  actor.user_id,
  seed.code,
  seed.title,
  seed.description,
  seed.department_or_domain,
  seed.credits,
  seed.level,
  seed.sequence_position,
  seed.learning_outcomes,
  seed.syllabus,
  'active',
  seed.domain_id,
  true
from programs
cross join actor
cross join (
  values
    (
      'RSYN 720',
      'Senior Thesis / Integrated Synthesis',
      'Terminal synthesis integrating philosophy, Scripture, doctrine, and history through a governed thesis project and final synthesis reflection.',
      'Catholic Theology',
      3,
      'Advanced',
      'Define and delimit a governing research question; consolidate bibliography and method architecture; produce a formal prospectus, draft, and final thesis with objections and replies; deliver a final synthesis reflection integrating philosophy, Scripture, doctrine, and history.',
      20,
      'Unit 1: Thesis question and scope.
Unit 2: Bibliography and method consolidation.
Unit 3: Prospectus.
Unit 4: Drafting and revision.
Unit 5: Final thesis and synthesis reflection.
Assessment: five staged milestones culminating in a 7000-10000 word thesis with an 800-1200 word synthesis reflection.',
      (select id from theo_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, sequence_position, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  title = 'Senior Thesis / Integrated Synthesis',
  description = 'Terminal synthesis integrating philosophy, Scripture, doctrine, and history through a governed thesis project and final synthesis reflection.',
  learning_outcomes = 'Define and delimit a governing research question; consolidate bibliography and method architecture; produce a formal prospectus, draft, and final thesis with objections and replies; deliver a final synthesis reflection integrating philosophy, Scripture, doctrine, and history.',
  syllabus = 'Unit 1: Thesis question and scope.
Unit 2: Bibliography and method consolidation.
Unit 3: Prospectus.
Unit 4: Drafting and revision.
Unit 5: Final thesis and synthesis reflection.
Assessment: five staged milestones culminating in a 7000-10000 word thesis with an 800-1200 word synthesis reflection.'
where code = 'RSYN 720';

-- Normalize legacy RSYN 720 modules
update modules m
set title = 'Thesis Question and Scope',
    overview = 'Define the governing research question and scope.',
    position = 0
from courses c
where c.id = m.course_id
  and c.code = 'RSYN 720'
  and m.title = 'Thesis Question and Prospectus Revision';

update modules m
set title = 'Bibliography and Method Consolidation',
    overview = 'Consolidate bibliography and method architecture.',
    position = 1
from courses c
where c.id = m.course_id
  and c.code = 'RSYN 720'
  and m.title = 'Source Dossier and Annotated Map';

update modules m
set title = 'Prospectus',
    overview = 'Produce a formal thesis prospectus.',
    position = 2
from courses c
where c.id = m.course_id
  and c.code = 'RSYN 720'
  and m.title = 'Argument Architecture and Chapter Drafts';

update modules m
set title = 'Drafting and Revision',
    overview = 'Draft the thesis and revise for coherence.',
    position = 3
from courses c
where c.id = m.course_id
  and c.code = 'RSYN 720'
  and m.title = 'Objections, Replies, and Revision';

update modules m
set title = 'Final Thesis and Synthesis Reflection',
    overview = 'Submit the final thesis and synthesis reflection.',
    position = 4
from courses c
where c.id = m.course_id
  and c.code = 'RSYN 720'
  and m.title = 'Final Thesis and Defense';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'RSYN 720'
  and rb.title = 'Research and Synthesis'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
rsyn as (
  select id from courses where code = 'RSYN 720' limit 1
),
rsyn_method as (
  select id from courses where code = 'RSYN 710' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from rsyn), (select id from rsyn_method))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for RSYN 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'RSYN 720' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Thesis Question and Scope', 'Define the governing research question and scope.', 0),
  ('Bibliography and Method Consolidation', 'Consolidate bibliography and method architecture.', 1),
  ('Prospectus', 'Produce a formal thesis prospectus.', 2),
  ('Drafting and Revision', 'Draft the thesis and revise for coherence.', 3),
  ('Final Thesis and Synthesis Reflection', 'Submit the final thesis and synthesis reflection.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- RSYN 720 uses student-selected sources; remove placeholder readings if present
with rsyn_modules as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 720'
)
delete from readings r
using rsyn_modules rm
where r.module_id = rm.id
  and r.title in (
    'Revised Thesis Prospectus',
    'Primary Source Dossier (minimum 3 primary texts)',
    'Argument Outline and Chapter Map',
    'Objections and Replies Memorandum',
    'Full Thesis Draft'
  );

-- Normalize legacy RSYN 720 assignments
update assignments a
set title = 'Thesis Question and Scope Statement',
    instructions = 'Define the research question, governing problem, and scope boundaries (1200-1800 words).',
    assignment_type = 'analysis'
from modules m
join courses c on c.id = m.course_id
where a.module_id = m.id
  and c.code = 'RSYN 720'
  and a.title = 'Revision: Thesis Prospectus';

update assignments a
set title = 'Annotated Bibliography and Method Memo',
    instructions = 'Deliver an annotated bibliography with a minimum of 6 primary and 4 secondary or magisterial sources plus a method architecture memo (1500-2200 words).',
    assignment_type = 'analysis'
from modules m
join courses c on c.id = m.course_id
where a.module_id = m.id
  and c.code = 'RSYN 720'
  and a.title = 'Analysis: Annotated Source Dossier';

update assignments a
set title = 'Thesis Prospectus',
    instructions = 'Produce a formal prospectus with central claim, argument outline, source map, and chapter architecture (1800-2600 words).',
    assignment_type = 'analysis'
from modules m
join courses c on c.id = m.course_id
where a.module_id = m.id
  and c.code = 'RSYN 720'
  and a.title = 'Draft: Argument Architecture';

update assignments a
set title = 'Draft Thesis with Objections and Replies',
    instructions = 'Submit a draft thesis with formal objections and replies and a revision plan (4500-6500 words).',
    assignment_type = 'analysis'
from modules m
join courses c on c.id = m.course_id
where a.module_id = m.id
  and c.code = 'RSYN 720'
  and a.title = 'Analysis: Objections and Replies';

update assignments a
set title = 'Final Thesis',
    instructions = 'Submit the full thesis (7000-10000 words).',
    assignment_type = 'essay'
from modules m
join courses c on c.id = m.course_id
where a.module_id = m.id
  and c.code = 'RSYN 720'
  and a.title = 'Capstone Thesis and Defense Memo';

-- Assignments for RSYN 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 720'
    and m.title = 'Thesis Question and Scope'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 720'
    and m.title = 'Bibliography and Method Consolidation'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 720'
    and m.title = 'Prospectus'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 720'
    and m.title = 'Drafting and Revision'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 720'
    and m.title = 'Final Thesis and Synthesis Reflection'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Thesis Question and Scope Statement', 'Define the research question, governing problem, and scope boundaries (1200-1800 words).', 'analysis'),
    ((select id from module_2), 'Annotated Bibliography and Method Memo', 'Deliver an annotated bibliography with a minimum of 6 primary and 4 secondary or magisterial sources plus a method architecture memo (1500-2200 words).', 'analysis'),
    ((select id from module_3), 'Thesis Prospectus', 'Produce a formal prospectus with central claim, argument outline, source map, and chapter architecture (1800-2600 words).', 'analysis'),
    ((select id from module_4), 'Draft Thesis with Objections and Replies', 'Submit a draft thesis with formal objections and replies and a revision plan (4500-6500 words).', 'analysis'),
    ((select id from module_5), 'Final Thesis', 'Submit the full thesis (7000-10000 words).', 'essay'),
    ((select id from module_5), 'Synthesis Reflection', 'Submit an 800-1200 word synthesis reflection on method, objections, and integration.', 'analysis')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- SPIR 720 - Spiritual Theology: Discernment, Purification, and Conformity to Christ
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
spir_domain as (
  select id from domains where title = 'Spiritual Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  code,
  title,
  description,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select
  programs.id,
  actor.user_id,
  seed.code,
  seed.title,
  seed.description,
  seed.department_or_domain,
  seed.credits,
  seed.level,
  seed.learning_outcomes,
  seed.syllabus,
  'active',
  seed.domain_id,
  true
from programs
cross join actor
cross join (
  values
    (
      'SPIR 720',
      'Spiritual Theology: Discernment, Purification, and Conformity to Christ',
      'Continuation of spiritual theology focused on discernment, purification, and the stages of growth toward conformity to Christ, grounded in classical sources and ecclesial tradition.',
      'Spiritual Theology',
      3,
      'Advanced',
      'Discern spiritual movements and test spirits; evaluate trials and purification in the spiritual life; explain theological virtues and gifts as lived form; describe stages of growth toward conformity to Christ; integrate discernment within ecclesial guidance without professionalizing spiritual direction.',
      'Unit 1: Discernment of spirits and interior motions (Ignatius, Rules for Discernment; Cassian, Conference 2).
Unit 2: Purification and trials in the spiritual life (John of the Cross, Dark Night I.1-5; 1 Peter 1:6-9).
Unit 3: Theological virtues and gifts in lived holiness (Aquinas, ST II-II q.23-24; ST I-II q.68).
Unit 4: Stages of growth and conformity to Christ (Teresa of Avila, Interior Castle I-II; Romans 8:14-29).
Assessment: three analyses and one synthetic essay grounded in primary texts.',
      (select id from spir_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Continuation of spiritual theology focused on discernment, purification, and the stages of growth toward conformity to Christ, grounded in classical sources and ecclesial tradition.',
  learning_outcomes = 'Discern spiritual movements and test spirits; evaluate trials and purification in the spiritual life; explain theological virtues and gifts as lived form; describe stages of growth toward conformity to Christ; integrate discernment within ecclesial guidance without professionalizing spiritual direction.',
  syllabus = 'Unit 1: Discernment of spirits and interior motions (Ignatius, Rules for Discernment; Cassian, Conference 2).
Unit 2: Purification and trials in the spiritual life (John of the Cross, Dark Night I.1-5; 1 Peter 1:6-9).
Unit 3: Theological virtues and gifts in lived holiness (Aquinas, ST II-II q.23-24; ST I-II q.68).
Unit 4: Stages of growth and conformity to Christ (Teresa of Avila, Interior Castle I-II; Romans 8:14-29).
Assessment: three analyses and one synthetic essay grounded in primary texts.'
where code = 'SPIR 720';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'SPIR 720'
  and rb.title = 'Spiritual Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
spir as (
  select id from courses where code = 'SPIR 720' limit 1
),
spir_foundation as (
  select id from courses where code = 'SPIR 710' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from spir), (select id from spir_foundation))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for SPIR 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'SPIR 720' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Discernment of Spirits and Interior Motions', 'Discernment of spirits and interior movements in spiritual life.', 0),
  ('Purification and Trials in the Spiritual Life', 'Purification, trials, and endurance in the spiritual life.', 1),
  ('Theological Virtues and Gifts in Lived Holiness', 'Theological virtues and gifts as the form of holy life.', 2),
  ('Stages of Growth and Conformity to Christ', 'Stages of spiritual growth and conformity to Christ.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for SPIR 720 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Discernment of Spirits and Interior Motions'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Purification and Trials in the Spiritual Life'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Theological Virtues and Gifts in Lived Holiness'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Stages of Growth and Conformity to Christ'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Rules for Discernment of Spirits, Week 1 (selections)', 'Ignatius of Loyola', 'Primary text', 'Primary', 'Reformation', 'Selections', 1.5, 'Ignatius of Loyola, Spiritual Exercises (Rules for Discernment, Week 1).', 0),
    ((select id from module_1), 'Conference 2: On Discernment (selections)', 'John Cassian', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'John Cassian, Conference 2.', 1),
    ((select id from module_2), 'Dark Night, Book I, ch. 1-5 (selections)', 'John of the Cross', 'Primary text', 'Primary', 'Modern', 'Book I, ch. 1-5', 2, 'John of the Cross, Dark Night, Book I, ch. 1-5.', 0),
    ((select id from module_2), '1 Peter 1:6-9', 'First Letter of Peter', 'Scripture', 'Primary', 'Apostolic', '1 Pet 1:6-9', 0.5, '1 Peter 1:6-9.', 1),
    ((select id from module_3), 'Summa Theologiae II-II, q.23-24 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST II-II q.23-24', 2, 'Aquinas, Summa Theologiae II-II, q.23-24.', 0),
    ((select id from module_3), 'Summa Theologiae I-II, q.68 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I-II q.68', 1.5, 'Aquinas, Summa Theologiae I-II, q.68.', 1),
    ((select id from module_4), 'Interior Castle I-II (selections)', 'Teresa of Avila', 'Primary text', 'Primary', 'Modern', 'Mansions I-II', 2, 'Teresa of Avila, Interior Castle, Mansions I-II.', 0),
    ((select id from module_4), 'Romans 8:14-29', 'Letter to the Romans', 'Scripture', 'Primary', 'Apostolic', 'Rom 8:14-29', 1, 'Romans 8:14-29.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for SPIR 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Discernment of Spirits and Interior Motions'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Purification and Trials in the Spiritual Life'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Theological Virtues and Gifts in Lived Holiness'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SPIR 720'
    and m.title = 'Stages of Growth and Conformity to Christ'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Discernment of Spirits', 'Write 900-1200 words analyzing discernment using Ignatius'' Rules for Discernment (Week 1) and Cassian''s Conference 2.', 'analysis'),
    ((select id from module_2), 'Analysis: Purification and Trials', 'Write 900-1200 words analyzing purification and trials using John of the Cross, Dark Night I.1-5 and 1 Peter 1:6-9.', 'analysis'),
    ((select id from module_3), 'Analysis: Virtues and Gifts', 'Write 900-1200 words analyzing the theological virtues and gifts using Aquinas ST II-II q.23-24 and ST I-II q.68.', 'analysis'),
    ((select id from module_4), 'Essay: Stages of Growth and Conformity', 'Write 1200-1500 words synthesizing stages of growth using Teresa of Avila, Interior Castle I-II and Romans 8:14-29.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
  where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- PHIL 630 - Epistemology: Truth, Judgment, and Assent
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
phil_domain as (
  select id from domains where title = 'Philosophy' limit 1
)
insert into courses (
  program_id,
  created_by,
  code,
  title,
  description,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select
  programs.id,
  actor.user_id,
  seed.code,
  seed.title,
  seed.description,
  seed.department_or_domain,
  seed.credits,
  seed.level,
  seed.learning_outcomes,
  seed.syllabus,
  'active',
  seed.domain_id,
  true
from programs
cross join actor
cross join (
  values
    (
      'PHIL 630',
      'Epistemology: Truth, Judgment, and Assent',
      'Classical epistemology of truth, knowledge, judgment, and assent grounded in realist metaphysics and intellectual discipline.',
      'Philosophy',
      3,
      'Advanced',
      'Explain truth as adequation and distinguish levels of intellectual knowledge; analyze abstraction, judgment, and certitude; diagnose error and its causes; articulate faith and reason as distinct modes of assent; cultivate intellectual virtues ordered to disciplined inquiry.',
      'Unit 1: Truth and intelligibility (Aquinas, De Veritate q.1 a.1; Aristotle, Metaphysics IV.7).
Unit 2: From sense to intellect (Aristotle, De Anima II.5-III.5; Aquinas, ST I q.79 a.1-4).
Unit 3: Judgment, certitude, and error (Aristotle, Posterior Analytics I.2-3; Augustine, De Magistro).
Unit 4: Faith, reason, and assent (Aquinas, ST II-II q.1 a.1-4; Newman, Grammar of Assent selections).
Unit 5: Intellectual virtues and discipline of thought (Aristotle, Nicomachean Ethics VI.2-3; Aquinas, ST I-II q.57 a.1-6).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from phil_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Classical epistemology of truth, knowledge, judgment, and assent grounded in realist metaphysics and intellectual discipline.',
  learning_outcomes = 'Explain truth as adequation and distinguish levels of intellectual knowledge; analyze abstraction, judgment, and certitude; diagnose error and its causes; articulate faith and reason as distinct modes of assent; cultivate intellectual virtues ordered to disciplined inquiry.',
  syllabus = 'Unit 1: Truth and intelligibility (Aquinas, De Veritate q.1 a.1; Aristotle, Metaphysics IV.7).
Unit 2: From sense to intellect (Aristotle, De Anima II.5-III.5; Aquinas, ST I q.79 a.1-4).
Unit 3: Judgment, certitude, and error (Aristotle, Posterior Analytics I.2-3; Augustine, De Magistro).
Unit 4: Faith, reason, and assent (Aquinas, ST II-II q.1 a.1-4; Newman, Grammar of Assent selections).
Unit 5: Intellectual virtues and discipline of thought (Aristotle, Nicomachean Ethics VI.2-3; Aquinas, ST I-II q.57 a.1-6).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'PHIL 630';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'PHIL 630'
  and rb.title = 'Foundations in Philosophy'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
phil as (
  select id from courses where code = 'PHIL 630' limit 1
),
phil_anthro as (
  select id from courses where code = 'PHIL 610' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from phil), (select id from phil_anthro))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for PHIL 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'PHIL 630' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Truth and Intelligibility', 'Truth as adequation and the intelligibility of being.', 0),
  ('From Sense to Intellect', 'Sensation, abstraction, and intellectual knowledge.', 1),
  ('Judgment, Certitude, and Error', 'Judgment, certainty, and the causes of error.', 2),
  ('Faith, Reason, and Assent', 'Faith, reason, and distinct modes of assent.', 3),
  ('Intellectual Virtues and Discipline of Thought', 'Intellectual virtues ordering inquiry and judgment.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for PHIL 630 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Truth and Intelligibility'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'From Sense to Intellect'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Judgment, Certitude, and Error'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Faith, Reason, and Assent'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Intellectual Virtues and Discipline of Thought'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'De Veritate q.1 a.1 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'q.1 a.1', 1.5, 'Aquinas, De Veritate q.1 a.1.', 0),
    ((select id from module_1), 'Metaphysics IV.7 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'IV.7', 1, 'Aristotle, Metaphysics IV.7.', 1),
    ((select id from module_2), 'De Anima II.5-III.5 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'II.5-III.5', 2, 'Aristotle, De Anima II.5-III.5.', 0),
    ((select id from module_2), 'Summa Theologiae I q.79 a.1-4 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.79 a.1-4', 1.5, 'Aquinas, ST I q.79 a.1-4.', 1),
    ((select id from module_3), 'Posterior Analytics I.2-3 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'I.2-3', 1.5, 'Aristotle, Posterior Analytics I.2-3.', 0),
    ((select id from module_3), 'De Magistro (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'Augustine, De Magistro.', 1),
    ((select id from module_4), 'Summa Theologiae II-II q.1 a.1-4 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST II-II q.1 a.1-4', 1.5, 'Aquinas, ST II-II q.1 a.1-4.', 0),
    ((select id from module_4), 'Grammar of Assent (selections)', 'John Henry Newman', 'Primary text', 'Primary', 'Modern', 'Selections', 1.5, 'Newman, Grammar of Assent.', 1),
    ((select id from module_5), 'Nicomachean Ethics VI.2-3 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'VI.2-3', 1.5, 'Aristotle, Nicomachean Ethics VI.2-3.', 0),
    ((select id from module_5), 'Summa Theologiae I-II q.57 a.1-6 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I-II q.57 a.1-6', 1.5, 'Aquinas, ST I-II q.57 a.1-6.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for PHIL 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Truth and Intelligibility'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'From Sense to Intellect'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Judgment, Certitude, and Error'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Faith, Reason, and Assent'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 630'
    and m.title = 'Intellectual Virtues and Discipline of Thought'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Truth and Intelligibility', 'Write 900-1200 words analyzing truth and adequation using Aquinas De Veritate q.1 a.1 and Aristotle Metaphysics IV.7.', 'analysis'),
    ((select id from module_2), 'Analysis: Sense and Intellect', 'Write 900-1200 words analyzing sensation and abstraction using Aristotle De Anima II.5-III.5 and Aquinas ST I q.79 a.1-4.', 'analysis'),
    ((select id from module_3), 'Analysis: Judgment and Certitude', 'Write 900-1200 words analyzing judgment and certitude using Aristotle Posterior Analytics I.2-3 and Augustine De Magistro.', 'analysis'),
    ((select id from module_4), 'Analysis: Faith and Assent', 'Write 900-1200 words analyzing faith and assent using Aquinas ST II-II q.1 a.1-4 and Newman Grammar of Assent.', 'analysis'),
    ((select id from module_5), 'Essay: Intellectual Virtues and Discipline', 'Write 1200-1500 words synthesizing intellectual virtues using Aristotle Nicomachean Ethics VI.2-3 and Aquinas ST I-II q.57 a.1-6.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
  where module_id is not null
    and not exists (
      select 1 from assignments a
      where a.module_id = seed.module_id and a.title = seed.title
    );

-- RSYN 710 - Research and Synthesis: Method and Thesis Architecture
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
theo_domain as (
  select id from domains where title = 'Catholic Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  code,
  title,
  description,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select
  programs.id,
  actor.user_id,
  seed.code,
  seed.title,
  seed.description,
  seed.department_or_domain,
  seed.credits,
  seed.level,
  seed.learning_outcomes,
  seed.syllabus,
  'active',
  seed.domain_id,
  true
from programs
cross join actor
cross join (
  values
    (
      'RSYN 710',
      'Research and Synthesis: Method and Thesis Architecture',
      'Methodological formation in theological research, argument structure, and disciplined synthesis across philosophy, Scripture, doctrine, and history.',
      'Catholic Theology',
      3,
      'Advanced',
      'Explain the nature of sacra doctrina and its method; order sources by authority and genre; construct arguments with objections and replies; diagnose error and ambiguity; draft a thesis prospectus with a disciplined source map and argument outline.',
      'Unit 1: Sacra doctrina and theological science (Aquinas, ST I q.1 a.1-10; Aristotle, Posterior Analytics I.1).
Unit 2: Sources and hierarchy of authority (Dei Verbum 7-10; Vincent of Lerins, Commonitorium 2-3).
Unit 3: Argument, objections, and disputation (Aquinas, ST I q.2 a.3; Aristotle, Topics I.1).
Unit 4: Synthesis and thesis architecture (Aquinas, ST I Prologue; Bonaventure, Breviloquium Prologue).
Assessment: three analyses and one thesis prospectus with method memo.',
      (select id from theo_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Methodological formation in theological research, argument structure, and disciplined synthesis across philosophy, Scripture, doctrine, and history.',
  learning_outcomes = 'Explain the nature of sacra doctrina and its method; order sources by authority and genre; construct arguments with objections and replies; diagnose error and ambiguity; draft a thesis prospectus with a disciplined source map and argument outline.',
  syllabus = 'Unit 1: Sacra doctrina and theological science (Aquinas, ST I q.1 a.1-10; Aristotle, Posterior Analytics I.1).
Unit 2: Sources and hierarchy of authority (Dei Verbum 7-10; Vincent of Lerins, Commonitorium 2-3).
Unit 3: Argument, objections, and disputation (Aquinas, ST I q.2 a.3; Aristotle, Topics I.1).
Unit 4: Synthesis and thesis architecture (Aquinas, ST I Prologue; Bonaventure, Breviloquium Prologue).
Assessment: three analyses and one thesis prospectus with method memo.'
where code = 'RSYN 710';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'RSYN 710'
  and rb.title = 'Research and Synthesis'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
rsyn as (
  select id from courses where code = 'RSYN 710' limit 1
),
phil_ep as (
  select id from courses where code = 'PHIL 630' limit 1
),
theo_found as (
  select id from courses where code = 'THEO 510' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from rsyn), (select id from phil_ep)),
    ((select id from rsyn), (select id from theo_found))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for RSYN 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'RSYN 710' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Sacra Doctrina and Theological Science', 'Nature and method of sacra doctrina and theological science.', 0),
  ('Sources and Hierarchy of Authority', 'Ordering authorities and sources in theological argument.', 1),
  ('Argument, Objections, and Disputation', 'Argument structure, objections, and replies.', 2),
  ('Synthesis and Thesis Architecture', 'Disciplined synthesis and thesis architecture.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for RSYN 710 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Sacra Doctrina and Theological Science'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Sources and Hierarchy of Authority'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Argument, Objections, and Disputation'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Synthesis and Thesis Architecture'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Summa Theologiae I, q.1 a.1-10 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.1 a.1-10', 2, 'Aquinas, ST I q.1 a.1-10.', 0),
    ((select id from module_1), 'Posterior Analytics I.1 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'I.1', 1, 'Aristotle, Posterior Analytics I.1.', 1),
    ((select id from module_2), 'Dei Verbum 7-10', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 7-10', 1, 'Second Vatican Council, Dei Verbum 7-10.', 0),
    ((select id from module_2), 'Commonitorium 2-3 (selections)', 'Vincent of Lerins', 'Patristic text', 'Primary', 'Patristic', 'Ch. 2-3', 1, 'Vincent of Lerins, Commonitorium 2-3.', 1),
    ((select id from module_3), 'Summa Theologiae I, q.2 a.3 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.2 a.3', 1.5, 'Aquinas, ST I q.2 a.3.', 0),
    ((select id from module_3), 'Topics I.1 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'I.1', 1, 'Aristotle, Topics I.1.', 1),
    ((select id from module_4), 'Summa Theologiae I Prologue', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'Prologue', 0.5, 'Aquinas, ST I Prologue.', 0),
    ((select id from module_4), 'Breviloquium Prologue (selections)', 'Bonaventure', 'Primary text', 'Primary', 'Medieval', 'Prologue', 1, 'Bonaventure, Breviloquium Prologue.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for RSYN 710
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Sacra Doctrina and Theological Science'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Sources and Hierarchy of Authority'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Argument, Objections, and Disputation'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'RSYN 710'
    and m.title = 'Synthesis and Thesis Architecture'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Sacra Doctrina and Method', 'Write 900-1200 words analyzing theological method using Aquinas ST I q.1 a.1-10 and Aristotle Posterior Analytics I.1.', 'analysis'),
    ((select id from module_2), 'Analysis: Source Hierarchy', 'Write 900-1200 words analyzing source hierarchy using Dei Verbum 7-10 and Vincent of Lerins Commonitorium 2-3.', 'analysis'),
    ((select id from module_3), 'Analysis: Objections and Replies', 'Write 900-1200 words analyzing objections and replies using Aquinas ST I q.2 a.3 and Aristotle Topics I.1.', 'analysis'),
    ((select id from module_4), 'Essay: Thesis Prospectus and Method Memo', 'Write 1200-1500 words producing a thesis prospectus with an argument outline, source map, and method memo grounded in Aquinas ST I Prologue and Bonaventure Breviloquium Prologue.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Advanced Dogmatics continuation (eschatology)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
dogm_domain as (
  select id from domains where title = 'Dogmatic Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'DOGM 720',
      'Dogmatic Theology: Eschatology and the Last Things',
      'Dogmatic theology of death, judgment, purgation, resurrection, and the consummation of creation, grounded in Scripture and magisterial teaching.',
      'Dogmatic Theology',
      3,
      'Advanced',
      'Explain Catholic doctrine on death and particular judgment; distinguish heaven, hell, and purgatory with doctrinal precision; articulate the resurrection of the body and the new creation; integrate eschatology with Christology and ecclesial hope without speculative sensationalism.',
      'Unit 1: Death and particular judgment (Hebrews 9:27; CCC 1005-1022).
Unit 2: Heaven and the beatific vision (Benedictus Deus; CCC 1023-1029).
Unit 3: Hell and final impenitence (Matthew 25:31-46; CCC 1033-1037).
Unit 4: Purgatory and purification (Florence; Trent; CCC 1030-1032).
Unit 5: Resurrection and the new creation (1 Corinthians 15; Gaudium et Spes 39; CCC 988-1060).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from dogm_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Dogmatic theology of death, judgment, purgation, resurrection, and the consummation of creation, grounded in Scripture and magisterial teaching.',
  learning_outcomes = 'Explain Catholic doctrine on death and particular judgment; distinguish heaven, hell, and purgatory with doctrinal precision; articulate the resurrection of the body and the new creation; integrate eschatology with Christology and ecclesial hope without speculative sensationalism.',
  syllabus = 'Unit 1: Death and particular judgment (Hebrews 9:27; CCC 1005-1022).
Unit 2: Heaven and the beatific vision (Benedictus Deus; CCC 1023-1029).
Unit 3: Hell and final impenitence (Matthew 25:31-46; CCC 1033-1037).
Unit 4: Purgatory and purification (Florence; Trent; CCC 1030-1032).
Unit 5: Resurrection and the new creation (1 Corinthians 15; Gaudium et Spes 39; CCC 988-1060).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'DOGM 720';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'DOGM 720'
  and rb.title = 'Advanced Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
dogm as (
  select id from courses where code = 'DOGM 720' limit 1
),
dogm_pre as (
  select id from courses where code = 'DOGM 710' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from dogm), (select id from dogm_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for DOGM 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'DOGM 720' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Death and Particular Judgment', 'Death and judgment as the immediate horizon of the human person.', 0),
  ('Heaven and the Beatific Vision', 'The doctrine of heaven and the beatific vision.', 1),
  ('Hell and Final Impenitence', 'The reality of hell and the logic of final rejection.', 2),
  ('Purgatory and Purification', 'Post-mortem purification in the economy of salvation.', 3),
  ('Resurrection and the New Creation', 'Resurrection of the body and the consummation of creation.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for DOGM 720 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Death and Particular Judgment'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Heaven and the Beatific Vision'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Hell and Final Impenitence'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Purgatory and Purification'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Resurrection and the New Creation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Hebrews 9:27', 'Letter to the Hebrews', 'Scripture', 'Primary', 'Apostolic', 'Heb 9:27', 0.5, 'Hebrews 9:27.', 0),
    ((select id from module_1), 'Catechism of the Catholic Church 1005-1022', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1005-1022', 1.5, 'Catechism of the Catholic Church, 1005-1022.', 1),
    ((select id from module_2), 'Benedictus Deus (1336)', 'Benedict XII', 'Magisterial text', 'Primary', 'Medieval', 'Benedictus Deus', 1.5, 'Benedict XII, Benedictus Deus.', 0),
    ((select id from module_2), 'Catechism of the Catholic Church 1023-1029', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1023-1029', 1, 'Catechism of the Catholic Church, 1023-1029.', 1),
    ((select id from module_3), 'Matthew 25:31-46', 'Gospel of Matthew', 'Scripture', 'Primary', 'Apostolic', 'Matt 25:31-46', 1, 'Matthew 25:31-46.', 0),
    ((select id from module_3), 'Catechism of the Catholic Church 1033-1037', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1033-1037', 1, 'Catechism of the Catholic Church, 1033-1037.', 1),
    ((select id from module_4), 'Council of Florence: Decree for the Greeks (selections)', 'Council of Florence', 'Conciliar text', 'Primary', 'Renaissance', 'Selections', 1.5, 'Council of Florence, Decree for the Greeks (purgatory).', 0),
    ((select id from module_4), 'Council of Trent, Session 25 (selections)', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 25', 1.5, 'Council of Trent, Session 25 (purgatory).', 1),
    ((select id from module_5), '1 Corinthians 15 (selections)', 'First Letter to the Corinthians', 'Scripture', 'Primary', 'Apostolic', '1 Cor 15', 1.5, '1 Corinthians 15.', 0),
    ((select id from module_5), 'Gaudium et Spes 39', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'GS 39', 1, 'Second Vatican Council, Gaudium et Spes 39.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for DOGM 720
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Death and Particular Judgment'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Heaven and the Beatific Vision'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Hell and Final Impenitence'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Purgatory and Purification'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 720'
    and m.title = 'Resurrection and the New Creation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Death and Particular Judgment', 'Write 900-1200 words explaining Catholic teaching on death and particular judgment using Hebrews 9:27 and CCC 1005-1022.', 'analysis'),
    ((select id from module_2), 'Analysis: Heaven and the Beatific Vision', 'Write 900-1200 words analyzing the beatific vision using Benedictus Deus and CCC 1023-1029.', 'analysis'),
    ((select id from module_3), 'Analysis: Hell and Final Impenitence', 'Write 900-1200 words analyzing the doctrine of hell using Matthew 25:31-46 and CCC 1033-1037.', 'analysis'),
    ((select id from module_4), 'Analysis: Purgatory and Purification', 'Write 900-1200 words explaining purgatory using the Council of Florence and Trent Session 25.', 'analysis'),
    ((select id from module_5), 'Essay: Resurrection and the New Creation', 'Write 900-1200 words synthesizing the resurrection of the body and the new creation using 1 Corinthians 15 and Gaudium et Spes 39.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Upper-level Scripture consolidation (biblical theology)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
scrp_domain as (
  select id from domains where title = 'Scripture' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'SCRP 630',
      'Biblical Theology: Covenant, Kingdom, Temple, and New Creation',
      'Upper-level biblical theology tracing covenant, kingdom, temple, and new creation across the canon, integrating Scripture with ecclesial and sacramental life.',
      'Scripture',
      3,
      'Advanced',
      'Trace the covenantal arc from Abraham to the new covenant; analyze kingdom and Davidic promise as the horizon of messianic fulfillment; articulate temple and priesthood themes as fulfilled in Christ and the Church; integrate new creation motifs with eschatological hope without collapsing into dogmatic treatise.',
      'Unit 1: Covenant and election (Genesis 12-17; Exodus 19-24; Deuteronomy 6).
Unit 2: Kingdom and Davidic promise (2 Samuel 7; Psalm 2; Daniel 7).
Unit 3: Temple, priesthood, and sacrifice (Exodus 25-40; Leviticus 16; Hebrews 8-10).
Unit 4: New covenant and the people of God (Jeremiah 31:31-34; Luke 22:14-20; 1 Peter 2:4-10).
Unit 5: New creation and consummation (Isaiah 65:17-25; Romans 8:18-25; Revelation 21-22).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from scrp_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level biblical theology tracing covenant, kingdom, temple, and new creation across the canon, integrating Scripture with ecclesial and sacramental life.',
  learning_outcomes = 'Trace the covenantal arc from Abraham to the new covenant; analyze kingdom and Davidic promise as the horizon of messianic fulfillment; articulate temple and priesthood themes as fulfilled in Christ and the Church; integrate new creation motifs with eschatological hope without collapsing into dogmatic treatise.',
  syllabus = 'Unit 1: Covenant and election (Genesis 12-17; Exodus 19-24; Deuteronomy 6).
Unit 2: Kingdom and Davidic promise (2 Samuel 7; Psalm 2; Daniel 7).
Unit 3: Temple, priesthood, and sacrifice (Exodus 25-40; Leviticus 16; Hebrews 8-10).
Unit 4: New covenant and the people of God (Jeremiah 31:31-34; Luke 22:14-20; 1 Peter 2:4-10).
Unit 5: New creation and consummation (Isaiah 65:17-25; Romans 8:18-25; Revelation 21-22).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'SCRP 630';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'SCRP 630'
  and rb.title = 'Scripture Core'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
scrp as (
  select id from courses where code = 'SCRP 630' limit 1
),
scrp_pre as (
  select id from courses where code = 'SCRP 530' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from scrp), (select id from scrp_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for SCRP 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'SCRP 630' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Covenant and Election', 'Covenantal foundations from Abraham to Sinai.', 0),
  ('Kingdom and Davidic Promise', 'Royal promises and the horizon of the messianic kingdom.', 1),
  ('Temple, Priesthood, and Sacrifice', 'The temple and sacrificial logic fulfilled in Christ.', 2),
  ('New Covenant and the People of God', 'The new covenant and ecclesial identity.', 3),
  ('New Creation and Consummation', 'Scriptural vision of new creation and consummation.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for SCRP 630 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'Covenant and Election'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'Kingdom and Davidic Promise'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'Temple, Priesthood, and Sacrifice'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'New Covenant and the People of God'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'New Creation and Consummation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Genesis 12-17 and Exodus 19-24 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Gen 12-17; Ex 19-24', 2, 'Genesis 12-17; Exodus 19-24.', 0),
    ((select id from module_1), 'Deuteronomy 6 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Deut 6', 1, 'Deuteronomy 6.', 1),
    ((select id from module_2), '2 Samuel 7 and Psalm 2 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '2 Sam 7; Ps 2', 1.5, '2 Samuel 7; Psalm 2.', 0),
    ((select id from module_2), 'Daniel 7 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Dan 7', 1, 'Daniel 7.', 1),
    ((select id from module_3), 'Exodus 25-40 and Leviticus 16 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Ex 25-40; Lev 16', 2, 'Exodus 25-40; Leviticus 16.', 0),
    ((select id from module_3), 'Hebrews 8-10 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Heb 8-10', 1.5, 'Hebrews 8-10.', 1),
    ((select id from module_4), 'Jeremiah 31:31-34 and Luke 22:14-20 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Jer 31; Luke 22', 1.5, 'Jeremiah 31:31-34; Luke 22:14-20.', 0),
    ((select id from module_4), '1 Peter 2:4-10', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '1 Pet 2', 1, '1 Peter 2:4-10.', 1),
    ((select id from module_5), 'Isaiah 65:17-25 and Romans 8:18-25 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Isa 65; Rom 8', 1.5, 'Isaiah 65:17-25; Romans 8:18-25.', 0),
    ((select id from module_5), 'Revelation 21-22 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Rev 21-22', 1.5, 'Revelation 21-22.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for SCRP 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'Covenant and Election'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'Kingdom and Davidic Promise'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'Temple, Priesthood, and Sacrifice'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'New Covenant and the People of God'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 630'
    and m.title = 'New Creation and Consummation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Covenant and Election', 'Write 900-1200 words analyzing covenantal election using Genesis 12-17, Exodus 19-24, and Deuteronomy 6.', 'analysis'),
    ((select id from module_2), 'Analysis: Kingdom and Davidic Promise', 'Write 900-1200 words analyzing the Davidic promise using 2 Samuel 7, Psalm 2, and Daniel 7.', 'analysis'),
    ((select id from module_3), 'Analysis: Temple and Sacrifice', 'Write 900-1200 words analyzing temple and priesthood using Exodus 25-40, Leviticus 16, and Hebrews 8-10.', 'analysis'),
    ((select id from module_4), 'Analysis: New Covenant and the People of God', 'Write 900-1200 words analyzing the new covenant using Jeremiah 31:31-34, Luke 22:14-20, and 1 Peter 2:4-10.', 'analysis'),
    ((select id from module_5), 'Essay: New Creation and Consummation', 'Write 900-1200 words synthesizing the new creation using Isaiah 65:17-25, Romans 8:18-25, and Revelation 21-22.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Scripture specialization (Pauline theology)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
scrp_domain as (
  select id from domains where title = 'Scripture' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'SCRP 640',
      'Pauline Theology: Grace, Church, and Hope',
      'Upper-level Pauline theology centered on grace and justification, ecclesial identity as the body of Christ, and eschatological hope.',
      'Scripture',
      3,
      'Advanced',
      'Interpret Paul’s doctrine of justification and grace; articulate ecclesial identity as the body of Christ; analyze law, freedom, and moral formation in Pauline ethics; integrate resurrection hope with eschatological consummation without collapsing into dogmatic treatise.',
      'Unit 1: Justification and grace (Romans 3-8; Galatians 2-3).
Unit 2: The body of Christ and ecclesial communion (1 Corinthians 12; Ephesians 4).
Unit 3: Law, freedom, and moral formation (Galatians 5; Romans 12-13).
Unit 4: Resurrection hope and new creation (1 Corinthians 15; Philippians 3:20-21).
Assessment: three analyses and one synthetic essay grounded in primary texts.',
      (select id from scrp_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level Pauline theology centered on grace and justification, ecclesial identity as the body of Christ, and eschatological hope.',
  learning_outcomes = 'Interpret Paul’s doctrine of justification and grace; articulate ecclesial identity as the body of Christ; analyze law, freedom, and moral formation in Pauline ethics; integrate resurrection hope with eschatological consummation without collapsing into dogmatic treatise.',
  syllabus = 'Unit 1: Justification and grace (Romans 3-8; Galatians 2-3).
Unit 2: The body of Christ and ecclesial communion (1 Corinthians 12; Ephesians 4).
Unit 3: Law, freedom, and moral formation (Galatians 5; Romans 12-13).
Unit 4: Resurrection hope and new creation (1 Corinthians 15; Philippians 3:20-21).
Assessment: three analyses and one synthetic essay grounded in primary texts.'
where code = 'SCRP 640';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'SCRP 640'
  and rb.title = 'Scripture Core'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
scrp as (
  select id from courses where code = 'SCRP 640' limit 1
),
scrp_pre as (
  select id from courses where code = 'SCRP 630' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from scrp), (select id from scrp_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for SCRP 640
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'SCRP 640' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Justification and Grace', 'Justification, grace, and participation in Christ.', 0),
  ('The Body of Christ and Ecclesial Communion', 'Ecclesial identity and unity in the body of Christ.', 1),
  ('Law, Freedom, and Moral Formation', 'Law and freedom in Pauline moral theology.', 2),
  ('Resurrection Hope and New Creation', 'Resurrection and eschatological hope in Pauline theology.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for SCRP 640 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'Justification and Grace'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'The Body of Christ and Ecclesial Communion'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'Law, Freedom, and Moral Formation'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'Resurrection Hope and New Creation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Romans 3-8 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Rom 3-8', 2, 'Romans 3-8.', 0),
    ((select id from module_1), 'Galatians 2-3 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Gal 2-3', 1.5, 'Galatians 2-3.', 1),
    ((select id from module_2), '1 Corinthians 12', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '1 Cor 12', 1, '1 Corinthians 12.', 0),
    ((select id from module_2), 'Ephesians 4 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Eph 4', 1, 'Ephesians 4.', 1),
    ((select id from module_3), 'Galatians 5 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Gal 5', 1, 'Galatians 5.', 0),
    ((select id from module_3), 'Romans 12-13 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Rom 12-13', 1.5, 'Romans 12-13.', 1),
    ((select id from module_4), '1 Corinthians 15 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '1 Cor 15', 1.5, '1 Corinthians 15.', 0),
    ((select id from module_4), 'Philippians 3:20-21', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Phil 3:20-21', 0.5, 'Philippians 3:20-21.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for SCRP 640
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'Justification and Grace'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'The Body of Christ and Ecclesial Communion'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'Law, Freedom, and Moral Formation'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 640'
    and m.title = 'Resurrection Hope and New Creation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Justification and Grace', 'Write 900-1200 words analyzing justification and grace using Romans 3-8 and Galatians 2-3.', 'analysis'),
    ((select id from module_2), 'Analysis: Body of Christ and Communion', 'Write 900-1200 words analyzing ecclesial communion using 1 Corinthians 12 and Ephesians 4.', 'analysis'),
    ((select id from module_3), 'Analysis: Law, Freedom, and Moral Formation', 'Write 900-1200 words analyzing law and freedom using Galatians 5 and Romans 12-13.', 'analysis'),
    ((select id from module_4), 'Essay: Resurrection Hope', 'Write 900-1200 words synthesizing resurrection hope using 1 Corinthians 15 and Philippians 3:20-21.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Church history continuation (medieval Latin Christendom)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
hist_domain as (
  select id from domains where title = 'Church History' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'HIST 630',
      'Medieval Church: Monasticism, Reform, and Christendom',
      'Upper-level church history covering the formation of Latin Christendom, monastic and papal reform, scholastic consolidation, and late medieval crises that set the stage for later rupture.',
      'Church History',
      3,
      'Advanced',
      'Explain the formation of Latin Christendom through monastic and pastoral reform; analyze papal authority and reform movements in primary sources; assess scholastic and conciliar consolidation of doctrine and sacramental life; evaluate late medieval crises and reform pressures without collapsing into Reformation history.',
      'Unit 1: Monastic foundations and pastoral reform (Rule of St. Benedict; Gregory the Great).
Unit 2: Papal reform and ecclesial authority (Dictatus Papae; reform correspondence).
Unit 3: Scholastic and conciliar consolidation (Fourth Lateran Council; Aquinas).
Unit 4: Mendicant renewal and urban Christianity (Rule of St. Francis; Bonaventure).
Unit 5: Late medieval crisis and calls for reform (Catherine of Siena; Council of Constance).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from hist_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level church history covering the formation of Latin Christendom, monastic and papal reform, scholastic consolidation, and late medieval crises that set the stage for later rupture.',
  learning_outcomes = 'Explain the formation of Latin Christendom through monastic and pastoral reform; analyze papal authority and reform movements in primary sources; assess scholastic and conciliar consolidation of doctrine and sacramental life; evaluate late medieval crises and reform pressures without collapsing into Reformation history.',
  syllabus = 'Unit 1: Monastic foundations and pastoral reform (Rule of St. Benedict; Gregory the Great).
Unit 2: Papal reform and ecclesial authority (Dictatus Papae; reform correspondence).
Unit 3: Scholastic and conciliar consolidation (Fourth Lateran Council; Aquinas).
Unit 4: Mendicant renewal and urban Christianity (Rule of St. Francis; Bonaventure).
Unit 5: Late medieval crisis and calls for reform (Catherine of Siena; Council of Constance).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'HIST 630';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'HIST 630'
  and rb.title = 'Church History Core'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
hist as (
  select id from courses where code = 'HIST 630' limit 1
),
hist_pre as (
  select id from courses where code = 'HIST 520' limit 1
),
patr_pre as (
  select id from courses where code = 'PATR 610' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from hist), (select id from hist_pre)),
    ((select id from hist), (select id from patr_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for HIST 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'HIST 630' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Monastic Foundations and Pastoral Reform', 'Monastic formation and pastoral consolidation in early medieval Christendom.', 0),
  ('Papal Reform and Ecclesial Authority', 'Reform movements and the articulation of papal authority.', 1),
  ('Scholastic and Conciliar Consolidation', 'Scholastic theology and conciliar definitions within Latin Christendom.', 2),
  ('Mendicant Renewal and Urban Christianity', 'Mendicant movements and renewal in the high medieval Church.', 3),
  ('Late Medieval Crisis and Calls for Reform', 'Crisis, schism, and reform pressures before the Reformation.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for HIST 630 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Monastic Foundations and Pastoral Reform'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Papal Reform and Ecclesial Authority'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Scholastic and Conciliar Consolidation'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Mendicant Renewal and Urban Christianity'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Late Medieval Crisis and Calls for Reform'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Rule of St. Benedict (selections)', 'Benedict of Nursia', 'Monastic text', 'Primary', 'Medieval', 'Selections', 1.5, 'Rule of St. Benedict, selections.', 0),
    ((select id from module_1), 'Pastoral Rule, Book II (selections)', 'Gregory the Great', 'Patristic text', 'Primary', 'Patristic', 'Book II', 1.5, 'Gregory the Great, Pastoral Rule, Book II.', 1),
    ((select id from module_2), 'Dictatus Papae (selections)', 'Gregory VII', 'Papal text', 'Primary', 'Medieval', 'Selections', 1, 'Gregory VII, Dictatus Papae.', 0),
    ((select id from module_2), 'Letter to the German bishops (selections)', 'Gregory VII', 'Papal text', 'Primary', 'Medieval', 'Selections', 1, 'Gregory VII, Epistolae, selected letters.', 1),
    ((select id from module_3), 'Fourth Lateran Council, canons 1 and 21', 'Fourth Lateran Council', 'Conciliar text', 'Primary', 'Medieval', 'Canons 1, 21', 1, 'Fourth Lateran Council, canons 1 and 21.', 0),
    ((select id from module_3), 'Summa Theologiae, III q.60-65 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST III q.60-65', 2, 'Aquinas, Summa Theologiae III, q.60-65.', 1),
    ((select id from module_4), 'Earlier Rule of St. Francis (1221, selections)', 'Francis of Assisi', 'Monastic text', 'Primary', 'Medieval', 'Selections', 1, 'Francis of Assisi, Earlier Rule, selections.', 0),
    ((select id from module_4), 'Bonaventure, Legenda Major (selections)', 'Bonaventure', 'Primary text', 'Primary', 'Medieval', 'Selections', 1.5, 'Bonaventure, Legenda Major, selections.', 1),
    ((select id from module_5), 'Catherine of Siena, Letter to Pope Gregory XI (selections)', 'Catherine of Siena', 'Primary text', 'Primary', 'Medieval', 'Selections', 1, 'Catherine of Siena, Letter to Gregory XI.', 0),
    ((select id from module_5), 'Council of Constance, Haec Sancta (selections)', 'Council of Constance', 'Conciliar text', 'Primary', 'Medieval', 'Selections', 1.5, 'Council of Constance, Haec Sancta.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for HIST 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Monastic Foundations and Pastoral Reform'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Papal Reform and Ecclesial Authority'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Scholastic and Conciliar Consolidation'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Mendicant Renewal and Urban Christianity'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 630'
    and m.title = 'Late Medieval Crisis and Calls for Reform'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Monastic Foundations and Pastoral Reform', 'Write 900-1200 words analyzing the formation of Latin Christendom using the Rule of St. Benedict and Gregory the Great''s Pastoral Rule (Book II).', 'analysis'),
    ((select id from module_2), 'Analysis: Papal Reform and Authority', 'Write 900-1200 words analyzing papal reform using the Dictatus Papae and selected letters of Gregory VII.', 'analysis'),
    ((select id from module_3), 'Analysis: Scholastic and Conciliar Consolidation', 'Write 900-1200 words analyzing scholastic and conciliar consolidation using Fourth Lateran canons 1 and 21 and Aquinas ST III q.60-65.', 'analysis'),
    ((select id from module_4), 'Analysis: Mendicant Renewal', 'Write 900-1200 words analyzing mendicant renewal using the Earlier Rule of St. Francis and Bonaventure''s Legenda Major.', 'analysis'),
    ((select id from module_5), 'Essay: Late Medieval Crisis and Reform', 'Write 900-1200 words synthesizing late medieval reform pressures using Catherine of Siena''s letter to Gregory XI and the Council of Constance''s Haec Sancta.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Church history continuation (Reformation and Catholic Reform)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
hist_domain as (
  select id from domains where title = 'Church History' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'HIST 640',
      'Reformation and Catholic Reform',
      'Upper-level church history covering the Protestant break, Catholic reform, and confessional consolidation in the sixteenth century.',
      'Church History',
      3,
      'Advanced',
      'Explain late medieval reform pressures and the Protestant break; analyze key confessional texts of the Reformation era; assess the Council of Trent’s doctrinal and disciplinary reforms; evaluate post-Tridentine renewal without reducing the period to caricature.',
      'Unit 1: Reform pressures on the eve of rupture (Fifth Lateran Council; Exsurge Domine).
Unit 2: Luther and the Protestant break (Ninety-Five Theses; Augsburg Confession).
Unit 3: The Council of Trent and Catholic reform (Trent Sessions 6 and 23, selections).
Unit 4: Post-Tridentine renewal and discipline (Ignatius of Loyola, Constitutions; Roman Catechism, Preface).
Assessment: three analyses and one synthetic essay grounded in primary texts.',
      (select id from hist_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level church history covering the Protestant break, Catholic reform, and confessional consolidation in the sixteenth century.',
  learning_outcomes = 'Explain late medieval reform pressures and the Protestant break; analyze key confessional texts of the Reformation era; assess the Council of Trent’s doctrinal and disciplinary reforms; evaluate post-Tridentine renewal without reducing the period to caricature.',
  syllabus = 'Unit 1: Reform pressures on the eve of rupture (Fifth Lateran Council; Exsurge Domine).
Unit 2: Luther and the Protestant break (Ninety-Five Theses; Augsburg Confession).
Unit 3: The Council of Trent and Catholic reform (Trent Sessions 6 and 23, selections).
Unit 4: Post-Tridentine renewal and discipline (Ignatius of Loyola, Constitutions; Roman Catechism, Preface).
Assessment: three analyses and one synthetic essay grounded in primary texts.'
where code = 'HIST 640';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'HIST 640'
  and rb.title = 'Church History Core'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
hist as (
  select id from courses where code = 'HIST 640' limit 1
),
hist_pre as (
  select id from courses where code = 'HIST 630' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from hist), (select id from hist_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for HIST 640
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'HIST 640' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Reform Pressures and the Eve of Rupture', 'Late medieval reform pressures and the lead-in to rupture.', 0),
  ('Luther and the Protestant Break', 'The Lutheran break and early confessional identity.', 1),
  ('The Council of Trent and Catholic Reform', 'Trent and the Catholic response to reform.', 2),
  ('Post-Tridentine Renewal and Discipline', 'Renewal and discipline in the post-Tridentine Church.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for HIST 640 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'Reform Pressures and the Eve of Rupture'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'Luther and the Protestant Break'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'The Council of Trent and Catholic Reform'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'Post-Tridentine Renewal and Discipline'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Fifth Lateran Council, Session 10 (reform of clergy, selections)', 'Fifth Lateran Council', 'Conciliar text', 'Primary', 'Renaissance', 'Session 10', 1.5, 'Fifth Lateran Council, Session 10 (reform).', 0),
    ((select id from module_1), 'Exsurge Domine (1520, selections)', 'Leo X', 'Papal text', 'Primary', 'Renaissance', 'Selections', 1, 'Leo X, Exsurge Domine.', 1),
    ((select id from module_2), 'Ninety-Five Theses (selections)', 'Martin Luther', 'Primary text', 'Primary', 'Reformation', 'Selections', 1.5, 'Martin Luther, Ninety-Five Theses.', 0),
    ((select id from module_2), 'Augsburg Confession, Articles IV-V (selections)', 'Philipp Melanchthon', 'Confessional text', 'Primary', 'Reformation', 'Articles IV-V', 1, 'Augsburg Confession, Articles IV-V.', 1),
    ((select id from module_3), 'Council of Trent, Session 6 (Decree on Justification, selections)', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 6', 1.5, 'Council of Trent, Session 6.', 0),
    ((select id from module_3), 'Council of Trent, Session 23 (On Reform, selections)', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 23', 1.5, 'Council of Trent, Session 23.', 1),
    ((select id from module_4), 'Constitutions of the Society of Jesus (selections)', 'Ignatius of Loyola', 'Constitutional text', 'Primary', 'Modern', 'Selections', 1.5, 'Ignatius of Loyola, Constitutions.', 0),
    ((select id from module_4), 'Roman Catechism, Preface (selections)', 'Council of Trent', 'Magisterial text', 'Primary', 'Reformation', 'Preface', 1, 'Roman Catechism, Preface.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for HIST 640
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'Reform Pressures and the Eve of Rupture'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'Luther and the Protestant Break'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'The Council of Trent and Catholic Reform'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 640'
    and m.title = 'Post-Tridentine Renewal and Discipline'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Reform Pressures before Rupture', 'Write 900-1200 words analyzing reform pressures using Fifth Lateran Session 10 and Exsurge Domine.', 'analysis'),
    ((select id from module_2), 'Analysis: The Protestant Break', 'Write 900-1200 words analyzing the Lutheran break using the Ninety-Five Theses and Augsburg Confession Articles IV-V.', 'analysis'),
    ((select id from module_3), 'Analysis: Trent and Catholic Reform', 'Write 900-1200 words analyzing the Council of Trent using Session 6 and Session 23.', 'analysis'),
    ((select id from module_4), 'Essay: Post-Tridentine Renewal', 'Write 900-1200 words synthesizing post-Tridentine renewal using the Jesuit Constitutions and the Roman Catechism Preface.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Scripture specialization (Johannine theology)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
scrp_domain as (
  select id from domains where title = 'Scripture' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'SCRP 650',
      'Johannine Theology: Word, Witness, and Communion',
      'Upper-level Johannine theology centered on the Word made flesh, the revelation of glory through signs and passion, and communion through Spirit and love.',
      'Scripture',
      3,
      'Advanced',
      'Interpret Johannine revelation of the Word and glory in the public ministry; analyze passion and resurrection as the disclosure of divine glory; articulate the Spirit’s witness and discernment in Johannine letters; explain Johannine communion and abiding without collapsing into devotional abstraction.',
      'Unit 1: Word, signs, and revelation (John 7-12).
Unit 2: Passion, glory, and witness (John 18-21).
Unit 3: Spirit, truth, and discernment (John 20:19-23; 1 John 4:1-6).
Unit 4: Love, communion, and abiding (1 John 3:1-18; 2 John 5-6).
Unit 5: Apocalypse and new creation (John 5:24-29; Revelation 21-22).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from scrp_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level Johannine theology centered on the Word made flesh, the revelation of glory through signs and passion, and communion through Spirit and love.',
  learning_outcomes = 'Interpret Johannine revelation of the Word and glory in the public ministry; analyze passion and resurrection as the disclosure of divine glory; articulate the Spirit’s witness and discernment in Johannine letters; explain Johannine communion and abiding without collapsing into devotional abstraction.',
  syllabus = 'Unit 1: Word, signs, and revelation (John 7-12).
Unit 2: Passion, glory, and witness (John 18-21).
Unit 3: Spirit, truth, and discernment (John 20:19-23; 1 John 4:1-6).
Unit 4: Love, communion, and abiding (1 John 3:1-18; 2 John 5-6).
Unit 5: Apocalypse and new creation (John 5:24-29; Revelation 21-22).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'SCRP 650';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'SCRP 650'
  and rb.title = 'Scripture Core'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
scrp as (
  select id from courses where code = 'SCRP 650' limit 1
),
scrp_pre as (
  select id from courses where code = 'SCRP 630' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from scrp), (select id from scrp_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for SCRP 650
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'SCRP 650' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Word, Signs, and Revelation', 'The Word made flesh revealed through signs in the public ministry.', 0),
  ('Passion, Glory, and Witness', 'Glory disclosed in the passion and resurrection with apostolic witness.', 1),
  ('Spirit, Truth, and Discernment', 'The Spirit’s testimony and discernment of truth in the Johannine letters.', 2),
  ('Love, Communion, and Abiding', 'Communion through love and abiding in God.', 3),
  ('Apocalypse and New Creation', 'Johannine eschatological tension and new creation hope.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for SCRP 650 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Word, Signs, and Revelation'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Passion, Glory, and Witness'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Spirit, Truth, and Discernment'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Love, Communion, and Abiding'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Apocalypse and New Creation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'John 7-12 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'John 7-12', 2, 'Gospel of John 7-12.', 0),
    ((select id from module_1), 'Cyril of Alexandria, Commentary on John (selections)', 'Cyril of Alexandria', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'Cyril of Alexandria, Commentary on John, selections.', 1),
    ((select id from module_2), 'John 18-21 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'John 18-21', 2, 'Gospel of John 18-21.', 0),
    ((select id from module_2), 'Augustine, Tractates on John 118-123 (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Tractates 118-123', 1.5, 'Augustine, Tractates on the Gospel of John 118-123.', 1),
    ((select id from module_3), 'John 20:19-23', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'John 20:19-23', 0.5, 'Gospel of John 20:19-23.', 0),
    ((select id from module_3), '1 John 4:1-6', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '1 John 4:1-6', 0.5, '1 John 4:1-6.', 1),
    ((select id from module_4), '1 John 3:1-18', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '1 John 3:1-18', 1, '1 John 3:1-18.', 0),
    ((select id from module_4), '2 John 5-6', 'Scripture', 'Scripture', 'Primary', 'Apostolic', '2 John 5-6', 0.5, '2 John 5-6.', 1),
    ((select id from module_5), 'John 5:24-29', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'John 5:24-29', 0.5, 'Gospel of John 5:24-29.', 0),
    ((select id from module_5), 'Revelation 21-22 (selections)', 'Scripture', 'Scripture', 'Primary', 'Apostolic', 'Rev 21-22', 1.5, 'Revelation 21-22.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for SCRP 650
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Word, Signs, and Revelation'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Passion, Glory, and Witness'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Spirit, Truth, and Discernment'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Love, Communion, and Abiding'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 650'
    and m.title = 'Apocalypse and New Creation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Signs and Revelation', 'Write 900-1200 words analyzing Johannine signs and revelation using John 7-12 and Cyril of Alexandria''s Commentary on John (selections).', 'analysis'),
    ((select id from module_2), 'Analysis: Passion and Glory', 'Write 900-1200 words analyzing Johannine glory in the passion and resurrection using John 18-21 and Augustine''s Tractates 118-123.', 'analysis'),
    ((select id from module_3), 'Analysis: Spirit and Truth', 'Write 900-1200 words analyzing Johannine discernment using John 20:19-23 and 1 John 4:1-6.', 'analysis'),
    ((select id from module_4), 'Analysis: Love and Communion', 'Write 900-1200 words analyzing Johannine love and communion using 1 John 3:1-18 and 2 John 5-6.', 'analysis'),
    ((select id from module_5), 'Essay: Johannine New Creation', 'Write 900-1200 words synthesizing Johannine eschatological tension using John 5:24-29 and Revelation 21-22.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Philosophy deepening (philosophical anthropology)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
phil_domain as (
  select id from domains where title = 'Philosophy' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'PHIL 610',
      'Philosophical Anthropology: Soul, Intellect, and Person',
      'Upper-level philosophical anthropology on the human person: soul and body, intellect and will, freedom, personhood, and immortality, grounding later theological and moral formation without collapsing into them.',
      'Philosophy',
      3,
      'Advanced',
      'Explain the hylomorphic account of soul and body; analyze intellect and will as faculties of rational nature; articulate philosophical accounts of freedom and moral agency; define person and nature in classical sources; assess philosophical arguments for the soul’s immateriality and immortality.',
      'Unit 1: Soul and body (Aristotle, De Anima II; Aquinas, ST I q.75-76).
Unit 2: Intellect and knowledge (Aristotle, De Anima III; Aquinas, ST I q.79).
Unit 3: Will, freedom, and moral agency (Aristotle, Nicomachean Ethics III; Aquinas, ST I q.82-83).
Unit 4: Person and nature (Boethius, Contra Eutychen; Aquinas, ST I q.29).
Unit 5: Immortality and human flourishing (Aquinas, ST I q.75 a6; Aristotle, Nicomachean Ethics X).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from phil_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level philosophical anthropology on the human person: soul and body, intellect and will, freedom, personhood, and immortality, grounding later theological and moral formation without collapsing into them.',
  learning_outcomes = 'Explain the hylomorphic account of soul and body; analyze intellect and will as faculties of rational nature; articulate philosophical accounts of freedom and moral agency; define person and nature in classical sources; assess philosophical arguments for the soul’s immateriality and immortality.',
  syllabus = 'Unit 1: Soul and body (Aristotle, De Anima II; Aquinas, ST I q.75-76).
Unit 2: Intellect and knowledge (Aristotle, De Anima III; Aquinas, ST I q.79).
Unit 3: Will, freedom, and moral agency (Aristotle, Nicomachean Ethics III; Aquinas, ST I q.82-83).
Unit 4: Person and nature (Boethius, Contra Eutychen; Aquinas, ST I q.29).
Unit 5: Immortality and human flourishing (Aquinas, ST I q.75 a6; Aristotle, Nicomachean Ethics X).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'PHIL 610';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'PHIL 610'
  and rb.title = 'Foundations in Philosophy'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
phil as (
  select id from courses where code = 'PHIL 610' limit 1
),
phil_pre as (
  select id from courses where code = 'PHIL 501' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from phil), (select id from phil_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for PHIL 610
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'PHIL 610' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Soul and Body', 'Hylomorphic account of the soul-body unity.', 0),
  ('Intellect and Knowledge', 'Intellective powers and the nature of knowledge.', 1),
  ('Will, Freedom, and Moral Agency', 'Will, freedom, and rational agency in classical sources.', 2),
  ('Person and Nature', 'Definition of person and its metaphysical implications.', 3),
  ('Immortality and Human Flourishing', 'Philosophical arguments for immortality and the highest human good.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for PHIL 610 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Soul and Body'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Intellect and Knowledge'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Will, Freedom, and Moral Agency'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Person and Nature'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Immortality and Human Flourishing'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'De Anima II (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'De Anima II', 2, 'Aristotle, De Anima II.', 0),
    ((select id from module_1), 'Summa Theologiae I, q.75-76 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.75-76', 2, 'Aquinas, Summa Theologiae I, q.75-76.', 1),
    ((select id from module_2), 'De Anima III (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'De Anima III', 2, 'Aristotle, De Anima III.', 0),
    ((select id from module_2), 'Summa Theologiae I, q.79 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.79', 2, 'Aquinas, Summa Theologiae I, q.79.', 1),
    ((select id from module_3), 'Nicomachean Ethics III (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'NE III', 2, 'Aristotle, Nicomachean Ethics III.', 0),
    ((select id from module_3), 'Summa Theologiae I, q.82-83 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.82-83', 2, 'Aquinas, Summa Theologiae I, q.82-83.', 1),
    ((select id from module_4), 'Contra Eutychen (selections)', 'Boethius', 'Primary text', 'Primary', 'Late Antique', 'Selections', 1.5, 'Boethius, Contra Eutychen, selections.', 0),
    ((select id from module_4), 'Summa Theologiae I, q.29 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.29', 1.5, 'Aquinas, Summa Theologiae I, q.29.', 1),
    ((select id from module_5), 'Summa Theologiae I, q.75 a6 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.75 a6', 1.5, 'Aquinas, Summa Theologiae I, q.75 a6.', 0),
    ((select id from module_5), 'Nicomachean Ethics X (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'NE X', 2, 'Aristotle, Nicomachean Ethics X.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for PHIL 610
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Soul and Body'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Intellect and Knowledge'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Will, Freedom, and Moral Agency'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Person and Nature'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 610'
    and m.title = 'Immortality and Human Flourishing'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Soul and Body', 'Write 900-1200 words analyzing the soul-body unity using Aristotle De Anima II and Aquinas ST I q.75-76.', 'analysis'),
    ((select id from module_2), 'Analysis: Intellect and Knowledge', 'Write 900-1200 words analyzing intellect and knowledge using Aristotle De Anima III and Aquinas ST I q.79.', 'analysis'),
    ((select id from module_3), 'Analysis: Will and Freedom', 'Write 900-1200 words analyzing will and freedom using Aristotle Nicomachean Ethics III and Aquinas ST I q.82-83.', 'analysis'),
    ((select id from module_4), 'Analysis: Person and Nature', 'Write 900-1200 words analyzing person and nature using Boethius Contra Eutychen and Aquinas ST I q.29.', 'analysis'),
    ((select id from module_5), 'Essay: Immortality and Human Flourishing', 'Write 900-1200 words synthesizing philosophical arguments for immortality and the highest human good using Aquinas ST I q.75 a6 and Aristotle Nicomachean Ethics X.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Philosophy deepening (metaphysics of nature and participation)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
phil_domain as (
  select id from domains where title = 'Philosophy' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'PHIL 620',
      'Metaphysics of Nature: Substance, Causality, and Participation',
      'Upper-level metaphysics of nature focused on substance and accident, act and potency, causality, form and matter, and participation, extending foundations without repeating PHIL 501.',
      'Philosophy',
      3,
      'Advanced',
      'Distinguish substance and accident; analyze act and potency as principles of change; explain causality in nature; articulate form, matter, and teleology; assess participation and analogy as metaphysical principles.',
      'Unit 1: Substance and accident (Aristotle, Categories; Metaphysics VII).
Unit 2: Act, potency, and change (Aristotle, Metaphysics IX; Physics III).
Unit 3: Nature and causality (Aristotle, Physics II).
Unit 4: Form, matter, and teleology (Aristotle, Metaphysics VIII; Aquinas, De Principiis Naturae).
Unit 5: Participation and analogy (Boethius, De Hebdomadibus; Aquinas, Super De Hebdomadibus).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from phil_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Upper-level metaphysics of nature focused on substance and accident, act and potency, causality, form and matter, and participation, extending foundations without repeating PHIL 501.',
  learning_outcomes = 'Distinguish substance and accident; analyze act and potency as principles of change; explain causality in nature; articulate form, matter, and teleology; assess participation and analogy as metaphysical principles.',
  syllabus = 'Unit 1: Substance and accident (Aristotle, Categories; Metaphysics VII).
Unit 2: Act, potency, and change (Aristotle, Metaphysics IX; Physics III).
Unit 3: Nature and causality (Aristotle, Physics II).
Unit 4: Form, matter, and teleology (Aristotle, Metaphysics VIII; Aquinas, De Principiis Naturae).
Unit 5: Participation and analogy (Boethius, De Hebdomadibus; Aquinas, Super De Hebdomadibus).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'PHIL 620';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'PHIL 620'
  and rb.title = 'Foundations in Philosophy'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
phil as (
  select id from courses where code = 'PHIL 620' limit 1
),
phil_pre as (
  select id from courses where code = 'PHIL 501' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from phil), (select id from phil_pre))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for PHIL 620
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'PHIL 620' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Substance and Accident', 'Substance and accident as metaphysical categories of being.', 0),
  ('Act, Potency, and Change', 'Act and potency as principles of change.', 1),
  ('Nature and Causality', 'Nature and the four causes in the analysis of change.', 2),
  ('Form, Matter, and Teleology', 'Form, matter, and natural teleology.', 3),
  ('Participation and Analogy', 'Participation and analogy as metaphysical principles.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for PHIL 620 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Substance and Accident'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Act, Potency, and Change'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Nature and Causality'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Form, Matter, and Teleology'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Participation and Analogy'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Categories 1-5 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Categories 1-5', 2, 'Aristotle, Categories 1-5.', 0),
    ((select id from module_1), 'Metaphysics VII 1-3 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Metaphysics VII 1-3', 2, 'Aristotle, Metaphysics VII 1-3.', 1),
    ((select id from module_2), 'Metaphysics IX 1-6 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Metaphysics IX 1-6', 2, 'Aristotle, Metaphysics IX 1-6.', 0),
    ((select id from module_2), 'Physics III 1-3 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Physics III 1-3', 1.5, 'Aristotle, Physics III 1-3.', 1),
    ((select id from module_3), 'Physics II 1-7 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Physics II 1-7', 2, 'Aristotle, Physics II 1-7.', 0),
    ((select id from module_3), 'In Physicorum II (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'Commentary II', 1.5, 'Aquinas, Commentary on the Physics II.', 1),
    ((select id from module_4), 'Metaphysics VIII 1-3 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Metaphysics VIII 1-3', 1.5, 'Aristotle, Metaphysics VIII 1-3.', 0),
    ((select id from module_4), 'De Principiis Naturae (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'Selections', 1.5, 'Aquinas, De Principiis Naturae.', 1),
    ((select id from module_5), 'De Hebdomadibus (selections)', 'Boethius', 'Primary text', 'Primary', 'Late Antique', 'Selections', 1.5, 'Boethius, De Hebdomadibus.', 0),
    ((select id from module_5), 'Super De Hebdomadibus (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'Selections', 1.5, 'Aquinas, Super De Hebdomadibus.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for PHIL 620
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Substance and Accident'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Act, Potency, and Change'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Nature and Causality'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Form, Matter, and Teleology'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 620'
    and m.title = 'Participation and Analogy'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Substance and Accident', 'Write 900-1200 words analyzing substance and accident using Aristotle Categories 1-5 and Metaphysics VII 1-3.', 'analysis'),
    ((select id from module_2), 'Analysis: Act and Potency', 'Write 900-1200 words analyzing act and potency using Aristotle Metaphysics IX 1-6 and Physics III 1-3.', 'analysis'),
    ((select id from module_3), 'Analysis: Nature and Causality', 'Write 900-1200 words analyzing nature and causality using Aristotle Physics II 1-7 and Aquinas In Physicorum II.', 'analysis'),
    ((select id from module_4), 'Analysis: Form and Teleology', 'Write 900-1200 words analyzing form and teleology using Aristotle Metaphysics VIII 1-3 and Aquinas De Principiis Naturae.', 'analysis'),
    ((select id from module_5), 'Essay: Participation and Analogy', 'Write 900-1200 words synthesizing participation and analogy using Boethius De Hebdomadibus and Aquinas Super De Hebdomadibus.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Phase III: Advanced dogmatic synthesis (Trinity and Christology)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
),
dogm_domain as (
  select id from domains where title = 'Dogmatic Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  title,
  description,
  code,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select programs.id,
       actor.user_id,
       seed.title,
       seed.description,
       seed.code,
       seed.department_or_domain,
       seed.credits,
       seed.level,
       case seed.code
         when 'PHIL 501' then 10
         when 'PHIL 610' then 20
         when 'PHIL 620' then 30
         when 'PHIL 630' then 40
         when 'THEO 510' then 10
         when 'HIST 520' then 10
         when 'PATR 610' then 20
         when 'HIST 630' then 30
         when 'HIST 640' then 40
         when 'SCRP 530' then 10
         when 'SCRP 630' then 20
         when 'SCRP 640' then 30
         when 'SCRP 650' then 40
         when 'CONC 620' then 10
         when 'ECCL 630' then 20
         when 'LIT 640' then 30
         when 'DOGM 710' then 40
         when 'DOGM 720' then 50
         when 'DOGM 730' then 60
         when 'DOGM 740' then 70
         when 'MORL 710' then 10
         when 'MORL 720' then 20
         when 'SPIR 710' then 10
         when 'SPIR 720' then 20
         when 'RSYN 710' then 10
         when 'RSYN 720' then 20
         else null
       end as sequence_position,
       seed.learning_outcomes,
       seed.syllabus,
       'active',
       seed.domain_id,
       true
from programs
cross join actor
cross join (
  values
    (
      'DOGM 730',
      'Dogmatic Theology: Trinity and Christology (Synthesis)',
      'Advanced synthesis of Trinitarian and Christological doctrine grounded in Scripture, patristic theology, and scholastic precision without repeating conciliar history.',
      'Dogmatic Theology',
      3,
      'Advanced',
      'Articulate the scriptural missions and names of the divine persons; distinguish processions, relations, and persons in Trinitarian doctrine; explain the hypostatic union and communicatio idiomatum; evaluate Christ’s person and work in classical sources; integrate Trinitarian confession with the life and worship of the Church.',
      'Unit 1: Scriptural missions and divine names (John 1:1-18; John 14-17; Philippians 2:5-11).
Unit 2: Processions, relations, and persons (Gregory Nazianzen, Oration 29; Augustine, De Trinitate I).
Unit 3: Incarnation and hypostatic union (Leo the Great, Tome; Aquinas, ST III q.2-3).
Unit 4: Communicatio idiomatum and Christ’s work (Athanasius, On the Incarnation 54; Aquinas, ST III q.26).
Unit 5: Trinitarian confession in the Church’s life (Basil, On the Holy Spirit 9-12; CCC 232-267).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from dogm_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Advanced synthesis of Trinitarian and Christological doctrine grounded in Scripture, patristic theology, and scholastic precision without repeating conciliar history.',
  learning_outcomes = 'Articulate the scriptural missions and names of the divine persons; distinguish processions, relations, and persons in Trinitarian doctrine; explain the hypostatic union and communicatio idiomatum; evaluate Christ’s person and work in classical sources; integrate Trinitarian confession with the life and worship of the Church.',
  syllabus = 'Unit 1: Scriptural missions and divine names (John 1:1-18; John 14-17; Philippians 2:5-11).
Unit 2: Processions, relations, and persons (Gregory Nazianzen, Oration 29; Augustine, De Trinitate I).
Unit 3: Incarnation and hypostatic union (Leo the Great, Tome; Aquinas, ST III q.2-3).
Unit 4: Communicatio idiomatum and Christ’s work (Athanasius, On the Incarnation 54; Aquinas, ST III q.26).
Unit 5: Trinitarian confession in the Church’s life (Basil, On the Holy Spirit 9-12; CCC 232-267).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'DOGM 730';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'DOGM 730'
  and rb.title = 'Advanced Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
dogm as (
  select id from courses where code = 'DOGM 730' limit 1
),
conc as (
  select id from courses where code = 'CONC 620' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from dogm), (select id from conc))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for DOGM 730
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'DOGM 730' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Scriptural Missions and Divine Names', 'The missions and names of the divine persons in Scripture.', 0),
  ('Processions, Relations, and Persons', 'Trinitarian processions, relations, and persons in classical theology.', 1),
  ('Incarnation and Hypostatic Union', 'The incarnation and hypostatic union in patristic and scholastic sources.', 2),
  ('Communicatio Idiomatum and Christ’s Work', 'Communicatio idiomatum and Christ’s mediation.', 3),
  ('Trinitarian Confession in the Church', 'Trinitarian confession in worship and ecclesial life.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for DOGM 730 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Scriptural Missions and Divine Names'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Processions, Relations, and Persons'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Incarnation and Hypostatic Union'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Communicatio Idiomatum and Christ’s Work'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Trinitarian Confession in the Church'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'John 1:1-18', 'Gospel of John', 'Scripture', 'Primary', 'Apostolic', 'John 1:1-18', 1, 'Gospel of John 1:1-18.', 0),
    ((select id from module_1), 'John 14-17 (selections)', 'Gospel of John', 'Scripture', 'Primary', 'Apostolic', 'John 14-17', 1.5, 'Gospel of John 14-17.', 1),
    ((select id from module_1), 'Philippians 2:5-11', 'Letter to the Philippians', 'Scripture', 'Primary', 'Apostolic', 'Phil 2:5-11', 0.5, 'Philippians 2:5-11.', 2),
    ((select id from module_2), 'Oration 29 (selections)', 'Gregory Nazianzen', 'Patristic text', 'Primary', 'Patristic', 'Oration 29', 1.5, 'Gregory Nazianzen, Oration 29.', 0),
    ((select id from module_2), 'De Trinitate I (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Book I', 1.5, 'Augustine, De Trinitate I.', 1),
    ((select id from module_3), 'Tome of Leo (selections)', 'Leo the Great', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'Leo the Great, Tome.', 0),
    ((select id from module_3), 'Summa Theologiae III, q.2-3 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST III q.2-3', 2, 'Aquinas, Summa Theologiae III, q.2-3.', 1),
    ((select id from module_4), 'On the Incarnation 54 (selections)', 'Athanasius of Alexandria', 'Patristic text', 'Primary', 'Patristic', 'Ch. 54', 1.5, 'Athanasius, On the Incarnation 54.', 0),
    ((select id from module_4), 'Summa Theologiae III, q.26 (selections)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST III q.26', 1.5, 'Aquinas, Summa Theologiae III, q.26.', 1),
    ((select id from module_5), 'On the Holy Spirit 9-12 (selections)', 'Basil of Caesarea', 'Patristic text', 'Primary', 'Patristic', 'Ch. 9-12', 1.5, 'Basil of Caesarea, On the Holy Spirit 9-12.', 0),
    ((select id from module_5), 'Catechism of the Catholic Church 232-267', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 232-267', 1.5, 'Catechism of the Catholic Church, 232-267.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for DOGM 730
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Scriptural Missions and Divine Names'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Processions, Relations, and Persons'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Incarnation and Hypostatic Union'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Communicatio Idiomatum and Christ’s Work'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 730'
    and m.title = 'Trinitarian Confession in the Church'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Missions and Divine Names', 'Write 900-1200 words analyzing Trinitarian missions using John 1:1-18, John 14-17, and Philippians 2:5-11.', 'analysis'),
    ((select id from module_2), 'Analysis: Processions and Persons', 'Write 900-1200 words analyzing processions and persons using Gregory Nazianzen Oration 29 and Augustine De Trinitate I.', 'analysis'),
    ((select id from module_3), 'Analysis: Hypostatic Union', 'Write 900-1200 words analyzing the hypostatic union using the Tome of Leo and Aquinas ST III q.2-3.', 'analysis'),
    ((select id from module_4), 'Analysis: Communicatio Idiomatum', 'Write 900-1200 words analyzing communicatio idiomatum using Athanasius On the Incarnation 54 and Aquinas ST III q.26.', 'analysis'),
    ((select id from module_5), 'Essay: Trinitarian Confession in the Church', 'Write 900-1200 words synthesizing Trinitarian confession using Basil On the Holy Spirit 9-12 and CCC 232-267.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
  where a.module_id = seed.module_id and a.title = seed.title
  );

-- DOGM 740 - Marian Dogmatics: Mother of God and the Church
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
dogm_domain as (
  select id from domains where title = 'Dogmatic Theology' limit 1
)
insert into courses (
  program_id,
  created_by,
  code,
  title,
  description,
  department_or_domain,
  credits_or_weight,
  level,
  sequence_position,
  learning_outcomes,
  syllabus,
  status,
  domain_id,
  is_active
)
select
  programs.id,
  actor.user_id,
  seed.code,
  seed.title,
  seed.description,
  seed.department_or_domain,
  seed.credits,
  seed.level,
  seed.learning_outcomes,
  seed.syllabus,
  'active',
  seed.domain_id,
  true
from programs
cross join actor
cross join (
  values
    (
      'DOGM 740',
      'Marian Dogmatics: Mother of God and the Church',
      'Doctrinal synthesis of Mary in the mystery of Christ and the Church, grounded in Scripture, patristic typology, conciliar teaching, and magisterial definition.',
      'Dogmatic Theology',
      3,
      'Advanced',
      'Interpret Marian doctrine within Christology and ecclesiology; explain the Theotokos and its Christological significance; evaluate Marian typology in Scripture and patristic sources; distinguish the dogmas of the Immaculate Conception and Assumption and their theological rationale; integrate Marian doctrine with the Church''s worship and life without devotional reduction.',
      'Unit 1: Scriptural foundations and typology (Luke 1-2; John 2; John 19:25-27; Genesis 3:15).
Unit 2: Theotokos and Christological confession (Council of Ephesus; Cyril''s Christological reasoning).
Unit 3: Eve-Mary typology and patristic witness (Irenaeus, Against Heresies III.22.4).
Unit 4: Marian dogmatic definitions (Ineffabilis Deus; Munificentissimus Deus).
Unit 5: Mary and the Church (Lumen Gentium, chapter 8).
Assessment: four analyses and one synthetic essay grounded in primary texts.',
      (select id from dogm_domain)
    )
) as seed(code, title, description, department_or_domain, credits, level, learning_outcomes, syllabus, domain_id)
where not exists (
  select 1 from courses c
  where c.program_id = programs.id and c.code = seed.code
);

update courses
set
  description = 'Doctrinal synthesis of Mary in the mystery of Christ and the Church, grounded in Scripture, patristic typology, conciliar teaching, and magisterial definition.',
  learning_outcomes = 'Interpret Marian doctrine within Christology and ecclesiology; explain the Theotokos and its Christological significance; evaluate Marian typology in Scripture and patristic sources; distinguish the dogmas of the Immaculate Conception and Assumption and their theological rationale; integrate Marian doctrine with the Church''s worship and life without devotional reduction.',
  syllabus = 'Unit 1: Scriptural foundations and typology (Luke 1-2; John 2; John 19:25-27; Genesis 3:15).
Unit 2: Theotokos and Christological confession (Council of Ephesus; Cyril''s Christological reasoning).
Unit 3: Eve-Mary typology and patristic witness (Irenaeus, Against Heresies III.22.4).
Unit 4: Marian dogmatic definitions (Ineffabilis Deus; Munificentissimus Deus).
Unit 5: Mary and the Church (Lumen Gentium, chapter 8).
Assessment: four analyses and one synthetic essay grounded in primary texts.'
where code = 'DOGM 740';

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
program as (
  select id from programs where title = 'Devine College Core' limit 1
)
insert into course_requirement_blocks (course_id, requirement_block_id, created_by)
select c.id, rb.id, actor.user_id
from courses c
join requirement_blocks rb on rb.program_id = c.program_id
cross join actor
cross join program
where c.program_id = program.id
  and c.code = 'DOGM 740'
  and rb.title = 'Advanced Theology'
  and not exists (
    select 1 from course_requirement_blocks crb
    where crb.course_id = c.id and crb.requirement_block_id = rb.id
  );

with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
dogm as (
  select id from courses where code = 'DOGM 740' limit 1
),
dogm_synth as (
  select id from courses where code = 'DOGM 730' limit 1
)
insert into course_prerequisites (course_id, prerequisite_course_id, created_by)
select course_id, prerequisite_course_id, actor.user_id
from actor
cross join (
  values
    ((select id from dogm), (select id from dogm_synth))
) as seed(course_id, prerequisite_course_id)
where course_id is not null
  and prerequisite_course_id is not null
  and not exists (
    select 1 from course_prerequisites cp
    where cp.course_id = seed.course_id
      and cp.prerequisite_course_id = seed.prerequisite_course_id
  );

-- Modules for DOGM 740
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'DOGM 740' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Scriptural Foundations and Typology', 'Mary in Scripture and typological foundations for Marian doctrine.', 0),
  ('Theotokos and Christological Confession', 'Mary as Theotokos within the Christological confession of the Church.', 1),
  ('Eve-Mary Typology in Patristic Witness', 'Patristic testimony on the Eve-Mary parallel and Marian obedience.', 2),
  ('Dogmatic Definitions: Immaculate Conception and Assumption', 'Marian dogmas and their doctrinal rationale.', 3),
  ('Mary and the Church', 'Ecclesial and liturgical reception of Marian doctrine.', 4)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for DOGM 740 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Scriptural Foundations and Typology'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Theotokos and Christological Confession'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Eve-Mary Typology in Patristic Witness'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Dogmatic Definitions: Immaculate Conception and Assumption'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Mary and the Church'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Luke 1-2 (selections)', 'Gospel of Luke', 'Scripture', 'Primary', 'Apostolic', 'Luke 1-2', 1.5, 'Gospel of Luke 1-2.', 0),
    ((select id from module_1), 'John 2; John 19:25-27', 'Gospel of John', 'Scripture', 'Primary', 'Apostolic', 'John 2; John 19:25-27', 1, 'Gospel of John 2; John 19:25-27.', 1),
    ((select id from module_1), 'Genesis 3:15', 'Genesis', 'Scripture', 'Primary', 'Apostolic', 'Gen 3:15', 0.25, 'Genesis 3:15.', 2),
    ((select id from module_2), 'Council of Ephesus (definition)', 'Council of Ephesus', 'Magisterial text', 'Primary', 'Patristic', 'Definition', 1, 'Council of Ephesus, definition of Theotokos.', 0),
    ((select id from module_2), 'Second Letter to Nestorius (selections)', 'Cyril of Alexandria', 'Patristic text', 'Primary', 'Patristic', 'Selections', 1.5, 'Cyril of Alexandria, Second Letter to Nestorius.', 1),
    ((select id from module_3), 'Against Heresies III.22.4', 'Irenaeus of Lyons', 'Patristic text', 'Primary', 'Patristic', 'III.22.4', 1, 'Irenaeus, Against Heresies III.22.4.', 0),
    ((select id from module_4), 'Ineffabilis Deus (selections)', 'Pius IX', 'Magisterial text', 'Primary', 'Modern', 'Selections', 1.5, 'Ineffabilis Deus.', 0),
    ((select id from module_4), 'Munificentissimus Deus (selections)', 'Pius XII', 'Magisterial text', 'Primary', 'Modern', 'Selections', 1.5, 'Munificentissimus Deus.', 1),
    ((select id from module_5), 'Lumen Gentium, ch. 8 (selections)', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'Selections', 2, 'Lumen Gentium, chapter 8.', 0)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for DOGM 740
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Scriptural Foundations and Typology'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Theotokos and Christological Confession'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Eve-Mary Typology in Patristic Witness'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Dogmatic Definitions: Immaculate Conception and Assumption'
  limit 1
),
module_5 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'DOGM 740'
    and m.title = 'Mary and the Church'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Scriptural Foundations', 'Write 900-1200 words analyzing Marian scriptural foundations using Luke 1-2, John 2, and John 19:25-27.', 'analysis'),
    ((select id from module_2), 'Analysis: Theotokos and Christology', 'Write 900-1200 words analyzing Theotokos in relation to Christology using Ephesus and Cyril’s letter.', 'analysis'),
    ((select id from module_3), 'Analysis: Eve-Mary Typology', 'Write 900-1200 words on the Eve-Mary typology using Irenaeus, Against Heresies III.22.4.', 'analysis'),
    ((select id from module_4), 'Analysis: Marian Dogmatic Definitions', 'Write 900-1200 words comparing the doctrinal reasoning of Ineffabilis Deus and Munificentissimus Deus.', 'analysis'),
    ((select id from module_5), 'Essay: Mary and the Church', 'Write 1200-1500 words synthesizing Marian doctrine in ecclesial life using Lumen Gentium chapter 8 and prior sources.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for PHIL 501
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'PHIL 501' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('The Philosophical Act', 'Philosophy as love of wisdom, first principles, and disciplined inquiry.', 0),
  ('Being and First Principles', 'Metaphysical foundations: being, essence, and causality.', 1),
  ('Natural Theology and the First Cause', 'From being to the question of God in classical metaphysics.', 2),
  ('Reason and the Preambles of Faith', 'How philosophical reason prepares for fundamental theology and the act of faith.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for PHIL 501 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'The Philosophical Act'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'Being and First Principles'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'Natural Theology and the First Cause'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'Reason and the Preambles of Faith'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Apology (selections)', 'Plato', 'Primary text', 'Primary', 'Classical', 'Apology 20a-42a', 2, 'Plato, Apology, trans. any standard edition.', 0),
    ((select id from module_1), 'Metaphysics I.1-2 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Metaphysics I.1-2', 2, 'Aristotle, Metaphysics, Book I.', 1),
    ((select id from module_1), 'An Introduction to Philosophy, ch. 1 (selections)', 'Jacques Maritain', 'Secondary text', 'Secondary', 'Modern', 'Chapter 1', 2, 'Maritain, An Introduction to Philosophy, ch. 1.', 2),
    ((select id from module_2), 'Metaphysics IV.1-3 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Metaphysics IV.1-3', 2, 'Aristotle, Metaphysics, Book IV.', 0),
    ((select id from module_2), 'De Ente et Essentia (sections 1-3)', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'Sections 1-3', 2.5, 'Aquinas, De Ente et Essentia.', 1),
    ((select id from module_3), 'Metaphysics XII.1-5 (selections)', 'Aristotle', 'Primary text', 'Primary', 'Classical', 'Metaphysics XII.1-5', 2, 'Aristotle, Metaphysics, Book XII.', 0),
    ((select id from module_3), 'Summa Theologiae I, q.2, a.1-3', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST I q.2 a.1-3', 2, 'Aquinas, Summa Theologiae I, q.2.', 1),
    ((select id from module_4), 'Dei Filius (chapter 4 selections)', 'First Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'Chapter 4', 1, 'Dei Filius, Vatican I, ch. 4.', 0),
    ((select id from module_4), 'Fides et Ratio 1-5 (selections)', 'John Paul II', 'Magisterial text', 'Primary', 'Modern', 'Sections 1-5', 1, 'John Paul II, Fides et Ratio, sections 1-5.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for PHIL 501
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'The Philosophical Act'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'Being and First Principles'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'Natural Theology and the First Cause'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PHIL 501'
    and m.title = 'Reason and the Preambles of Faith'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Essay: What is Philosophy?', 'Write 800-1200 words defining philosophy as a disciplined search for truth. Draw explicitly on Plato and Aristotle, and articulate the role of first principles. Provide citations or clear references to the readings.', 'essay'),
    ((select id from module_2), 'Analysis: First Principles and Being', 'Write 700-1000 words analyzing the relation between being and first principles. Engage Aristotle (Metaphysics IV) and Aquinas (De Ente et Essentia). Make your argument explicit and cite the texts.', 'analysis'),
    ((select id from module_3), 'Essay: The Question of God and First Cause', 'Write 900-1200 words presenting a philosophical account of first cause. Engage Aristotle (Metaphysics XII) and Aquinas (Summa Theologiae I, q.2). Make the argument explicit and cite the texts.', 'essay'),
    ((select id from module_4), 'Essay: Reason and the Preambles of Faith', 'Write 900-1200 words explaining how philosophical reason prepares for theological inquiry. Engage Dei Filius (ch. 4) and Fides et Ratio (sections 1-5), and show how the metaphysical foundations from earlier modules inform the act of faith.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for THEO 510
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'THEO 510' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Revelation and the Act of Faith', 'Revelation, faith, and the divine initiative in Catholic theology.', 0),
  ('Tradition, Scripture, and the Rule of Faith', 'Scripture and Tradition as the sources of theology.', 1),
  ('Magisterium and Theological Method', 'Authority, teaching office, and the discipline of theology.', 2),
  ('The Act of Faith and the Obedience of Reason', 'The nature of faith as intellectual assent under grace, the obedience of reason, and the relation of philosophical preparation to theological reception.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for THEO 510 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'Revelation and the Act of Faith'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'Tradition, Scripture, and the Rule of Faith'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'Magisterium and Theological Method'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'The Act of Faith and the Obedience of Reason'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Dei Verbum (sections 1-6)', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 1-6', 1, 'Dei Verbum, Vatican II, sections 1-6.', 0),
    ((select id from module_1), 'Dei Filius (chapter 2 selections)', 'First Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'Chapter 2', 1, 'Dei Filius, Vatican I, ch. 2.', 1),
    ((select id from module_1), 'Catechism of the Catholic Church 50-73', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 50-73', 1.5, 'Catechism of the Catholic Church, 50-73.', 2),
    ((select id from module_2), 'Dei Verbum (sections 7-16)', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 7-16', 1.5, 'Dei Verbum, Vatican II, sections 7-16.', 0),
    ((select id from module_2), 'Catechism of the Catholic Church 74-100', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 74-100', 1.5, 'Catechism of the Catholic Church, 74-100.', 1),
    ((select id from module_2), 'Against Heresies III.1-3 (selections)', 'Irenaeus of Lyons', 'Primary text', 'Primary', 'Patristic', 'III.1-3', 2, 'Irenaeus, Against Heresies, Book III.', 2),
    ((select id from module_3), 'Dei Verbum 10', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 10', 0.5, 'Dei Verbum, Vatican II, section 10.', 0),
    ((select id from module_3), 'Lumen Gentium 25', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'LG 25', 0.5, 'Lumen Gentium, Vatican II, section 25.', 1),
    ((select id from module_3), 'Donum Veritatis (selections)', 'Congregation for the Doctrine of the Faith', 'Magisterial text', 'Primary', 'Modern', 'Sections 16-23', 1, 'CDF, Donum Veritatis, sections 16-23.', 2),
    ((select id from module_4), 'Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST II-II q.1 a.1-5; q.2 a.1-3', 2.5, 'Aquinas, Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3.', 0),
    ((select id from module_4), 'Dei Filius (chapter 3: On Faith)', 'First Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'Chapter 3', 1, 'Dei Filius, Vatican I, ch. 3.', 1),
    ((select id from module_4), 'Catechism of the Catholic Church 142-175', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 142-175', 1.5, 'Catechism of the Catholic Church, 142-175.', 2)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for THEO 510
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'Revelation and the Act of Faith'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'Tradition, Scripture, and the Rule of Faith'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'Magisterium and Theological Method'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'The Act of Faith and the Obedience of Reason'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Reflection: Revelation and Faith', 'Write 900-1200 words explaining the Catholic understanding of revelation and the act of faith. Use Dei Verbum and Dei Filius as primary sources, with explicit citations.', 'essay'),
    ((select id from module_2), 'Exegesis: Tradition and Scripture', 'Write 900-1200 words analyzing the relationship between Scripture and Tradition in Dei Verbum 7-16. Incorporate Irenaeus (Against Heresies III) and the Catechism 74-100.', 'exegesis'),
    ((select id from module_3), 'Analysis: Magisterium and Theological Method', 'Write 900-1200 words explaining the authority of the Magisterium and its role in theological method. Engage Dei Verbum 10, Lumen Gentium 25, and Donum Veritatis with explicit citations.', 'analysis'),
    ((select id from module_4), 'Essay: The Act of Faith and the Obedience of Reason', 'Write 900-1200 words explaining the Catholic understanding of the act of faith as both reasonable and supernatural. Engage Aquinas (Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3), Dei Filius ch. 3, and CCC 142-175 with explicit citations. Show how the philosophical foundations established in PHIL 501 prepare for but do not determine the act of faith.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for HIST 520
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'HIST 520' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Apostolic Foundations and the Early Church', 'Apostolic witness, early communities, and emerging ecclesial order.', 0),
  ('Councils, Creeds, and Patristic Synthesis', 'Patristic theology, councils, and the formation of orthodox doctrine.', 1),
  ('Persecution, Martyrdom, and the Imperial Church', 'Martyrdom, persecution, and the Church in a changing empire.', 2),
  ('Augustine and Late Patristic Consolidation', 'Augustine and the maturation of doctrine in late antiquity.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for HIST 520 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Apostolic Foundations and the Early Church'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Councils, Creeds, and Patristic Synthesis'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Persecution, Martyrdom, and the Imperial Church'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Augustine and Late Patristic Consolidation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Acts 2-6 (selections)', 'The Acts of the Apostles', 'Scripture', 'Primary', 'Apostolic', 'Acts 2-6', 1.5, 'The Acts of the Apostles 2-6.', 0),
    ((select id from module_1), '1 Clement 42-44 (selections)', 'Clement of Rome', 'Patristic text', 'Primary', 'Apostolic', '42-44', 1, '1 Clement 42-44.', 1),
    ((select id from module_1), 'Letter to the Smyrnaeans (selections)', 'Ignatius of Antioch', 'Patristic text', 'Primary', 'Apostolic', 'Smyrn. 1-8', 1, 'Ignatius of Antioch, Letter to the Smyrnaeans.', 2),
    ((select id from module_2), 'Ecclesiastical History I.1-4 (selections)', 'Eusebius of Caesarea', 'Historical text', 'Primary', 'Patristic', 'Book I.1-4', 1.5, 'Eusebius, Ecclesiastical History, Book I.', 0),
    ((select id from module_2), 'Nicene Creed (325/381)', 'Ecumenical Councils', 'Conciliar text', 'Primary', 'Patristic', 'Creed', 0.5, 'Nicene-Constantinopolitan Creed.', 1),
    ((select id from module_2), 'On the Incarnation (selections)', 'Athanasius of Alexandria', 'Patristic text', 'Primary', 'Patristic', 'Chs. 1-10', 2, 'Athanasius, On the Incarnation.', 2),
    ((select id from module_3), 'Martyrdom of Polycarp (selections)', 'The Church of Smyrna', 'Patristic text', 'Primary', 'Patristic', 'Chs. 1-14', 1, 'Martyrdom of Polycarp.', 0),
    ((select id from module_3), 'Ecclesiastical History V.1-2 (selections)', 'Eusebius of Caesarea', 'Historical text', 'Primary', 'Patristic', 'Book V.1-2', 1.5, 'Eusebius, Ecclesiastical History, Book V.', 1),
    ((select id from module_3), 'Edict of Milan (313)', 'Constantine and Licinius', 'Imperial text', 'Primary', 'Patristic', 'Edict', 0.5, 'Edict of Milan (313).', 2),
    ((select id from module_4), 'Confessions Book VII (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Book VII', 1.5, 'Augustine, Confessions, Book VII.', 0),
    ((select id from module_4), 'City of God XIX (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Book XIX', 1.5, 'Augustine, City of God, Book XIX.', 1),
    ((select id from module_4), 'Definition of Chalcedon (451)', 'Council of Chalcedon', 'Conciliar text', 'Primary', 'Patristic', 'Definition', 0.5, 'Council of Chalcedon, Definition of Faith (451).', 2)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for HIST 520
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Apostolic Foundations and the Early Church'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Councils, Creeds, and Patristic Synthesis'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Persecution, Martyrdom, and the Imperial Church'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'HIST 520'
    and m.title = 'Augustine and Late Patristic Consolidation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Apostolic Witness and Ecclesial Order', 'Write 900-1200 words explaining how apostolic testimony and early ecclesial order are presented in Acts 2-6, 1 Clement 42-44, and Ignatius of Antioch. Use the texts directly and cite them explicitly.', 'analysis'),
    ((select id from module_2), 'Creedal Analysis: Nicaea and the Patristic Response', 'Write 900-1200 words analyzing the Nicene Creed in light of Eusebius and Athanasius. Identify the historical problem addressed and show how the patristic sources articulate orthodox doctrine.', 'analysis'),
    ((select id from module_3), 'Source Analysis: Martyrdom and the Imperial Turn', 'Write 900-1200 words tracing how martyrdom shaped early Christian identity and how the imperial turn altered the Church. Engage the Martyrdom of Polycarp, Eusebius V.1-2, and the Edict of Milan.', 'analysis'),
    ((select id from module_4), 'Analysis: Augustine and Doctrinal Consolidation', 'Write 900-1200 words analyzing Augustine''s contribution to late patristic consolidation. Engage Confessions VII, City of God XIX, and the Definition of Chalcedon to show doctrinal maturation.', 'analysis')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for SCRP 530
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'SCRP 530' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Revelation, Inspiration, and the Word of God', 'Catholic teaching on revelation, inspiration, and Scripture as the Word of God.', 0),
  ('Canon and Interpretation in the Church', 'Canon formation, Tradition, and ecclesial interpretation of Scripture.', 1),
  ('Ecclesial Reading and the Senses of Scripture', 'The literal and spiritual senses within the Church''s interpretive tradition.', 2),
  ('Gospel Foundations: The Gospel of John', 'Direct engagement with the Gospel of John as a foundation for ecclesial reading.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for SCRP 530 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Revelation, Inspiration, and the Word of God'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Canon and Interpretation in the Church'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Ecclesial Reading and the Senses of Scripture'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Gospel Foundations: The Gospel of John'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Dei Verbum 17-20', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 17-20', 1, 'Dei Verbum 17-20.', 0),
    ((select id from module_1), 'Providentissimus Deus (selections)', 'Leo XIII', 'Magisterial text', 'Primary', 'Modern', 'Selections', 1, 'Leo XIII, Providentissimus Deus.', 1),
    ((select id from module_1), 'Catechism of the Catholic Church 101-141', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 101-141', 2, 'Catechism of the Catholic Church, 101-141.', 2),
    ((select id from module_2), 'Dei Verbum 21-26', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 21-26', 1, 'Dei Verbum 21-26.', 0),
    ((select id from module_2), 'Divino Afflante Spiritu (selections)', 'Pius XII', 'Magisterial text', 'Primary', 'Modern', 'Selections', 1, 'Pius XII, Divino Afflante Spiritu.', 1),
    ((select id from module_2), 'The Interpretation of the Bible in the Church (Introduction)', 'Pontifical Biblical Commission', 'Magisterial text', 'Primary', 'Modern', 'Introduction', 1, 'Pontifical Biblical Commission, The Interpretation of the Bible in the Church.', 2),
    ((select id from module_3), 'De Doctrina Christiana I.1-10 (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Book I.1-10', 1.5, 'Augustine, De Doctrina Christiana, Book I.', 0),
    ((select id from module_3), 'Catechism of the Catholic Church 115-119', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 115-119', 0.5, 'Catechism of the Catholic Church, 115-119.', 1),
    ((select id from module_3), 'On First Principles IV (selections)', 'Origen', 'Patristic text', 'Primary', 'Patristic', 'Book IV', 1.5, 'Origen, On First Principles, Book IV.', 2),
    ((select id from module_4), 'Gospel of John 1-6 (selections)', 'The Gospel of John', 'Scripture', 'Primary', 'Apostolic', 'John 1-6', 2, 'The Gospel of John 1-6.', 0),
    ((select id from module_4), 'Gospel of John 13-17 (selections)', 'The Gospel of John', 'Scripture', 'Primary', 'Apostolic', 'John 13-17', 2, 'The Gospel of John 13-17.', 1),
    ((select id from module_4), 'Tractates on the Gospel of John 1-5 (selections)', 'Augustine of Hippo', 'Patristic text', 'Primary', 'Patristic', 'Tractates 1-5', 1.5, 'Augustine, Tractates on the Gospel of John, 1-5.', 2)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for SCRP 530
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Revelation, Inspiration, and the Word of God'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Canon and Interpretation in the Church'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Ecclesial Reading and the Senses of Scripture'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'SCRP 530'
    and m.title = 'Gospel Foundations: The Gospel of John'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Essay: Revelation and Inspiration', 'Write 900-1200 words explaining Catholic teaching on revelation and inspiration. Engage Dei Verbum 17-20, Providentissimus Deus, and CCC 101-141 with explicit citations.', 'essay'),
    ((select id from module_2), 'Method Memo: Canon and Ecclesial Interpretation', 'Write 900-1200 words outlining the Church''s canonical and interpretive principles for Scripture. Use Dei Verbum 21-26, Divino Afflante Spiritu, and the Pontifical Biblical Commission''s Introduction as primary sources.', 'analysis'),
    ((select id from module_3), 'Hermeneutics Memo: Literal and Spiritual Senses', 'Write 900-1200 words explaining the literal and spiritual senses of Scripture. Engage Augustine (De Doctrina Christiana I), CCC 115-119, and Origen (On First Principles IV) with explicit citations.', 'analysis'),
    ((select id from module_4), 'Exegesis: Word and Sign in John', 'Write 900-1200 words offering a close reading of John 1:1-18 and either John 6 or John 13-17. Use the Gospel text directly and incorporate Augustine''s Tractates to support your interpretation.', 'exegesis')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for PATR 610
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'PATR 610' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Apostolic Fathers and Early Church Order', 'Didache, Ignatius, and the formation of early ecclesial order.', 0),
  ('The Rule of Faith and the Gnostic Challenge', 'Irenaeus and the defense of apostolic doctrine.', 1),
  ('Apologists and the Defense of Christian Worship', 'Justin and early apologetic witness to worship and morality.', 2),
  ('Tradition and Scriptural Interpretation in the Early Fathers', 'Tertullian and Origen on Scripture and tradition.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for PATR 610 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'Apostolic Fathers and Early Church Order'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'The Rule of Faith and the Gnostic Challenge'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'Apologists and the Defense of Christian Worship'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'Tradition and Scriptural Interpretation in the Early Fathers'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Didache (selections)', 'The Didache', 'Patristic text', 'Primary', 'Patristic', 'Chs. 1-7; 9-10', 1.5, 'Didache, chs. 1-7; 9-10.', 0),
    ((select id from module_1), 'Letter to the Smyrnaeans (selections)', 'Ignatius of Antioch', 'Patristic text', 'Primary', 'Patristic', 'Smyrnaeans 1-8', 1.5, 'Ignatius of Antioch, Letter to the Smyrnaeans.', 1),
    ((select id from module_2), 'Against Heresies I.10 (selections)', 'Irenaeus of Lyons', 'Patristic text', 'Primary', 'Patristic', 'I.10', 1.5, 'Irenaeus, Against Heresies, Book I.10.', 0),
    ((select id from module_2), 'Against Heresies III.3 (selections)', 'Irenaeus of Lyons', 'Patristic text', 'Primary', 'Patristic', 'III.3', 1.5, 'Irenaeus, Against Heresies, Book III.3.', 1),
    ((select id from module_3), 'First Apology 13-17 (selections)', 'Justin Martyr', 'Patristic text', 'Primary', 'Patristic', 'Apology 13-17', 1.5, 'Justin Martyr, First Apology, chs. 13-17.', 0),
    ((select id from module_3), 'A Plea for the Christians (selections)', 'Athenagoras of Athens', 'Patristic text', 'Primary', 'Patristic', 'Chs. 1-4; 24-27', 1.5, 'Athenagoras, A Plea for the Christians, chs. 1-4; 24-27.', 1),
    ((select id from module_4), 'Prescription Against Heretics (selections)', 'Tertullian', 'Patristic text', 'Primary', 'Patristic', 'Chs. 13-19', 1.5, 'Tertullian, Prescription Against Heretics, chs. 13-19.', 0),
    ((select id from module_4), 'On First Principles, Preface (selections)', 'Origen', 'Patristic text', 'Primary', 'Patristic', 'Preface', 1.5, 'Origen, On First Principles, Preface.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for PATR 610
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'Apostolic Fathers and Early Church Order'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'The Rule of Faith and the Gnostic Challenge'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'Apologists and the Defense of Christian Worship'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'PATR 610'
    and m.title = 'Tradition and Scriptural Interpretation in the Early Fathers'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Apostolic Fathers and Ecclesial Order', 'Write 900-1200 words analyzing ecclesial order and worship in the Didache and Ignatius. Focus on how authority and unity are expressed.', 'analysis'),
    ((select id from module_2), 'Analysis: Rule of Faith and Gnostic Challenge', 'Write 900-1200 words explaining Irenaeus'' rule of faith and his response to gnosticism using Against Heresies I.10 and III.3.', 'analysis'),
    ((select id from module_3), 'Analysis: Apologetic Defense of Worship', 'Write 900-1200 words analyzing how Justin and Athenagoras defend Christian worship and moral life.', 'analysis'),
    ((select id from module_4), 'Analysis: Tradition and Scriptural Interpretation', 'Write 900-1200 words assessing how Tertullian and Origen frame Scripture and tradition as doctrinal authorities.', 'analysis')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for CONC 620
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'CONC 620' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Nicaea and the Homoousios', 'Nicaea''s confession of the Son and the doctrinal stakes of Arianism.', 0),
  ('Constantinople and the Spirit', 'Creedal consolidation and the confession of the Holy Spirit.', 1),
  ('Ephesus and the Theotokos', 'Christological controversy and the confession of Mary as Theotokos.', 2),
  ('Chalcedon and the Two Natures', 'The definitive Christological settlement at Chalcedon.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for CONC 620 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Nicaea and the Homoousios'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Constantinople and the Spirit'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Ephesus and the Theotokos'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Chalcedon and the Two Natures'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Nicene Creed (325)', 'Council of Nicaea', 'Conciliar text', 'Primary', 'Patristic', 'Creed', 0.5, 'Council of Nicaea, Creed (325).', 0),
    ((select id from module_1), 'Council of Nicaea Canons 1-6 (selections)', 'Council of Nicaea', 'Conciliar text', 'Primary', 'Patristic', 'Canons 1-6', 1, 'Council of Nicaea, Canons 1-6.', 1),
    ((select id from module_2), 'Nicene-Constantinopolitan Creed (381)', 'Council of Constantinople', 'Conciliar text', 'Primary', 'Patristic', 'Creed', 0.5, 'Council of Constantinople, Creed (381).', 0),
    ((select id from module_2), 'Council of Constantinople I Canons 1-7 (selections)', 'Council of Constantinople', 'Conciliar text', 'Primary', 'Patristic', 'Canons 1-7', 1, 'Council of Constantinople I, Canons 1-7.', 1),
    ((select id from module_3), 'Council of Ephesus Definition (431)', 'Council of Ephesus', 'Conciliar text', 'Primary', 'Patristic', 'Definition', 0.5, 'Council of Ephesus, Definition (431).', 0),
    ((select id from module_3), 'Third Letter to Nestorius (selections)', 'Cyril of Alexandria', 'Patristic text', 'Primary', 'Patristic', 'Letter', 1.5, 'Cyril of Alexandria, Third Letter to Nestorius.', 1),
    ((select id from module_4), 'Definition of Chalcedon (451)', 'Council of Chalcedon', 'Conciliar text', 'Primary', 'Patristic', 'Definition', 0.5, 'Council of Chalcedon, Definition of Faith (451).', 0),
    ((select id from module_4), 'Tome of Leo (selections)', 'Leo the Great', 'Patristic text', 'Primary', 'Patristic', 'Tome', 1.5, 'Leo the Great, Tome.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for CONC 620
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Nicaea and the Homoousios'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Constantinople and the Spirit'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Ephesus and the Theotokos'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'CONC 620'
    and m.title = 'Chalcedon and the Two Natures'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Nicaea and the Homoousios', 'Write 900-1200 words analyzing the Nicene Creed and canons. Explain the doctrinal stakes of homoousios.', 'analysis'),
    ((select id from module_2), 'Analysis: Constantinople and the Spirit', 'Write 900-1200 words analyzing the 381 Creed and canons, focusing on the confession of the Holy Spirit.', 'analysis'),
    ((select id from module_3), 'Analysis: Ephesus and the Theotokos', 'Write 900-1200 words explaining the Ephesus definition and Cyril''s letter. Clarify what is being confessed about Christ and Mary.', 'analysis'),
    ((select id from module_4), 'Analysis: Chalcedon and the Two Natures', 'Write 900-1200 words analyzing the Definition of Chalcedon and the Tome of Leo.', 'analysis')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for ECCL 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'ECCL 630' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Biblical and Patristic Images of the Church', 'Scriptural and patristic accounts of the Church as body, temple, and communion.', 0),
  ('Apostolic Succession and Episcopal Authority', 'Historical and theological foundations of episcopal authority.', 1),
  ('Magisterium and Infallibility', 'Magisterial authority and the protection of doctrine.', 2),
  ('Tradition and Development of Doctrine', 'How doctrine develops within the life of the Church.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for ECCL 630 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Biblical and Patristic Images of the Church'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Apostolic Succession and Episcopal Authority'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Magisterium and Infallibility'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Tradition and Development of Doctrine'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Ephesians 4:1-16 and 1 Corinthians 12:12-27', 'The Apostle Paul', 'Scripture', 'Primary', 'Apostolic', 'Eph 4; 1 Cor 12', 1.5, 'Ephesians 4:1-16; 1 Corinthians 12:12-27.', 0),
    ((select id from module_1), 'On the Unity of the Church (selections)', 'Cyprian of Carthage', 'Patristic text', 'Primary', 'Patristic', 'Unity 1-8', 1.5, 'Cyprian, On the Unity of the Church, chs. 1-8.', 1),
    ((select id from module_2), 'Against Heresies III.3 (selections)', 'Irenaeus of Lyons', 'Patristic text', 'Primary', 'Patristic', 'III.3', 1.5, 'Irenaeus, Against Heresies, Book III.3.', 0),
    ((select id from module_2), 'Letter to the Magnesians (selections)', 'Ignatius of Antioch', 'Patristic text', 'Primary', 'Patristic', 'Magnesians 6-7', 1.5, 'Ignatius of Antioch, Letter to the Magnesians.', 1),
    ((select id from module_3), 'Pastor Aeternus, chs. 3-4', 'Vatican Council I', 'Magisterial text', 'Primary', 'Modern', 'Chs. 3-4', 1.5, 'Vatican I, Pastor Aeternus, chs. 3-4.', 0),
    ((select id from module_3), 'Lumen Gentium 25', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'LG 25', 1, 'Second Vatican Council, Lumen Gentium 25.', 1),
    ((select id from module_4), 'Dei Verbum 7-10', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'DV 7-10', 1, 'Second Vatican Council, Dei Verbum 7-10.', 0),
    ((select id from module_4), 'Essay on the Development of Christian Doctrine (selections)', 'John Henry Newman', 'Theological text', 'Primary', 'Modern', 'Selections', 1.5, 'Newman, Essay on the Development of Christian Doctrine, selections.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for ECCL 630
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Biblical and Patristic Images of the Church'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Apostolic Succession and Episcopal Authority'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Magisterium and Infallibility'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'ECCL 630'
    and m.title = 'Tradition and Development of Doctrine'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Images of the Church', 'Write 900-1200 words analyzing Pauline images of the Church together with Cyprian''s unity doctrine.', 'analysis'),
    ((select id from module_2), 'Analysis: Apostolic Succession', 'Write 900-1200 words assessing Irenaeus and Ignatius on apostolic succession and episcopal authority.', 'analysis'),
    ((select id from module_3), 'Analysis: Magisterium and Infallibility', 'Write 900-1200 words analyzing Pastor Aeternus (chs. 3-4) and Lumen Gentium 25.', 'analysis'),
    ((select id from module_4), 'Essay: Tradition and Doctrinal Development', 'Write 900-1200 words evaluating how Dei Verbum 7-10 and Newman''s account of development clarify doctrinal continuity.', 'essay')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Modules for LIT 640
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'LIT 640' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id, seed.title, seed.overview, seed.position
from course
cross join actor
cross join (values
  ('Sacramental Economy and Signs', 'Nature of sacramental signs and the economy of grace.', 0),
  ('Baptism: Initiation and Regeneration', 'Scriptural and magisterial doctrine of baptism.', 1),
  ('Eucharist: Real Presence and Sacrifice', 'Scriptural, patristic, and conciliar doctrine of the Eucharist.', 2),
  ('Liturgy and Participation', 'Active participation and the ordering of liturgical life.', 3)
) as seed(title, overview, position)
where not exists (
  select 1 from modules m where m.course_id = course.id and m.title = seed.title
);

-- Readings for LIT 640 modules
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Sacramental Economy and Signs'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Baptism: Initiation and Regeneration'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Eucharist: Real Presence and Sacrifice'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Liturgy and Participation'
  limit 1
)
insert into readings (
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_1), 'Sacrosanctum Concilium 5-10', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'SC 5-10', 1, 'Second Vatican Council, Sacrosanctum Concilium 5-10.', 0),
    ((select id from module_1), 'Catechism of the Catholic Church 1113-1134', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 1113-1134', 1.5, 'Catechism of the Catholic Church, 1113-1134.', 1),
    ((select id from module_2), 'John 3:1-8 and Romans 6:1-11', 'The Gospels and Paul', 'Scripture', 'Primary', 'Apostolic', 'John 3; Rom 6', 1.5, 'John 3:1-8; Romans 6:1-11.', 0),
    ((select id from module_2), 'Council of Trent, Session 7: Canons on Baptism (selections)', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 7', 1.5, 'Council of Trent, Session 7, Canons on Baptism.', 1),
    ((select id from module_3), 'John 6:51-58 and 1 Corinthians 11:23-29', 'The Gospels and Paul', 'Scripture', 'Primary', 'Apostolic', 'John 6; 1 Cor 11', 1.5, 'John 6:51-58; 1 Corinthians 11:23-29.', 0),
    ((select id from module_3), 'Council of Trent, Session 13: Decree on the Eucharist (selections)', 'Council of Trent', 'Conciliar text', 'Primary', 'Reformation', 'Session 13', 1.5, 'Council of Trent, Session 13, Decree on the Eucharist.', 1),
    ((select id from module_4), 'Sacrosanctum Concilium 14-20', 'Second Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'SC 14-20', 1, 'Second Vatican Council, Sacrosanctum Concilium 14-20.', 0),
    ((select id from module_4), 'First Apology 65-67 (selections)', 'Justin Martyr', 'Patristic text', 'Primary', 'Patristic', 'Apology 65-67', 1.5, 'Justin Martyr, First Apology, chs. 65-67.', 1)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Assignments for LIT 640
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_1 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Sacramental Economy and Signs'
  limit 1
),
module_2 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Baptism: Initiation and Regeneration'
  limit 1
),
module_3 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Eucharist: Real Presence and Sacrifice'
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'LIT 640'
    and m.title = 'Liturgy and Participation'
  limit 1
)
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
select module_id, actor.user_id, title, instructions, assignment_type
from actor
cross join (
  values
    ((select id from module_1), 'Analysis: Sacramental Economy', 'Write 900-1200 words explaining sacramental signs using Sacrosanctum Concilium 5-10 and CCC 1113-1134.', 'analysis'),
    ((select id from module_2), 'Exegesis: Baptismal Regeneration', 'Write 900-1200 words exegeting John 3:1-8 and Romans 6:1-11, relating them to Trent''s canons on baptism.', 'exegesis'),
    ((select id from module_3), 'Analysis: Eucharistic Doctrine', 'Write 900-1200 words analyzing John 6 and 1 Corinthians 11 alongside Trent''s Session 13 decree.', 'analysis'),
    ((select id from module_4), 'Analysis: Liturgy and Participation', 'Write 900-1200 words analyzing Sacrosanctum Concilium 14-20 with patristic witness from Justin Martyr.', 'analysis')
) as seed(module_id, title, instructions, assignment_type)
where module_id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = seed.module_id and a.title = seed.title
  );

-- Explicit curricular sequence ordering (used for recommendation priority)
update courses
set sequence_position = case code
  when 'PHIL 501' then 10
  when 'PHIL 610' then 20
  when 'PHIL 620' then 30
  when 'PHIL 630' then 40
  when 'THEO 510' then 10
  when 'HIST 520' then 10
  when 'PATR 610' then 20
  when 'HIST 630' then 30
  when 'HIST 640' then 40
  when 'SCRP 530' then 10
  when 'SCRP 630' then 20
  when 'SCRP 640' then 30
  when 'SCRP 650' then 40
  when 'CONC 620' then 10
  when 'ECCL 630' then 20
  when 'LIT 640' then 30
  when 'DOGM 710' then 40
  when 'DOGM 720' then 50
  when 'DOGM 730' then 60
  when 'DOGM 740' then 70
  when 'MORL 710' then 10
  when 'MORL 720' then 20
  when 'SPIR 710' then 10
  when 'SPIR 720' then 20
  when 'RSYN 710' then 10
  when 'RSYN 720' then 20
  else sequence_position
end
where code in (
  'PHIL 501', 'PHIL 610', 'PHIL 620', 'PHIL 630',
  'THEO 510',
  'HIST 520', 'PATR 610', 'HIST 630', 'HIST 640',
  'SCRP 530', 'SCRP 630', 'SCRP 640', 'SCRP 650',
  'CONC 620', 'ECCL 630', 'LIT 640', 'DOGM 710', 'DOGM 720', 'DOGM 730', 'DOGM 740',
  'MORL 710', 'MORL 720',
  'SPIR 710', 'SPIR 720',
  'RSYN 710', 'RSYN 720'
);

commit;


