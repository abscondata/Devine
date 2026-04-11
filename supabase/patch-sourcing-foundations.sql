-- ============================================================================
-- PATCH: patch-sourcing-foundations.sql
-- ============================================================================
-- Purpose: Fill in real, verified canonical free-source URLs and recommended
-- print editions for the readings already seeded in PHIL 501 and THEO 510.
--
-- This patch UPDATES readings.reference_url_or_citation for the existing
-- seeded readings. It does not insert new readings and does not change titles,
-- authors, or page ranges.
--
-- All URLs were verified via WebFetch before this file was written. URLs that
-- could not be verified are marked UNVERIFIED and left with a recommended
-- print edition only (no fake URL is ever recorded).
--
-- Safety: Idempotent. Matches by (course code, module title, reading title).
-- Safe to run multiple times.
--
-- Run in: Supabase SQL Editor.
-- ============================================================================
--
-- VERIFICATION LOG (all 21 readings)
--
-- PHIL 501
--  1. Plato, Apology (selections)
--     VERIFIED  classics.mit.edu/Plato/apology.html  (Jowett trans., public domain)
--  2. Aristotle, Metaphysics I.1-2 (selections)
--     VERIFIED  classics.mit.edu/Aristotle/metaphysics.1.i.html  (W. D. Ross trans.)
--  3. Jacques Maritain, An Introduction to Philosophy, ch. 1 (selections)
--     UNVERIFIED  (20th c., in copyright; no canonical free source)
--     Recommended print: Sheed & Ward / Rowman & Littlefield, An Introduction
--     to Philosophy (E. I. Watkin trans.)
--  4. Aristotle, Metaphysics IV.1-3 (selections)
--     VERIFIED  classics.mit.edu/Aristotle/metaphysics.4.iv.html  (W. D. Ross trans.)
--  5. Thomas Aquinas, De Ente et Essentia (sections 1-3)
--     VERIFIED  isidore.co/aquinas/DeEnte&Essentia.htm  (Joseph Kenny OP trans.)
--  6. Aristotle, Metaphysics XII.1-5 (selections)
--     VERIFIED  classics.mit.edu/Aristotle/metaphysics.12.xii.html  (W. D. Ross trans.)
--  7. Thomas Aquinas, Summa Theologiae I, q.2, a.1-3
--     VERIFIED  newadvent.org/summa/1002.htm  (English Dominican Province, 1920)
--  8. First Vatican Council, Dei Filius (chapter 4 selections)
--     VERIFIED  papalencyclicals.net/councils/ecum20.htm  (canonical English text
--     of Dei Filius; vatican.va does not host an English version at a stable URL)
--  9. John Paul II, Fides et Ratio 1-5 (selections)
--     VERIFIED  vatican.va/content/john-paul-ii/en/encyclicals/documents/
--                hf_jp-ii_enc_14091998_fides-et-ratio.html
--
-- THEO 510
-- 10. Second Vatican Council, Dei Verbum (sections 1-6)
--     VERIFIED  vatican.va/archive/hist_councils/ii_vatican_council/documents/
--                vat-ii_const_19651118_dei-verbum_en.html
-- 11. First Vatican Council, Dei Filius (chapter 2 selections)
--     VERIFIED  papalencyclicals.net/councils/ecum20.htm  (same canonical source
--     as entry 8; contains chapters 2, 3, and 4)
-- 12. Catechism of the Catholic Church 50-73
--     VERIFIED  vatican.va/archive/ENG0015/__PE.HTM  (contains paragraph 50;
--     Catechism index at vatican.va/archive/ENG0015/_INDEX.HTM for full navigation)
-- 13. Second Vatican Council, Dei Verbum (sections 7-16)
--     VERIFIED  vatican.va/archive/hist_councils/ii_vatican_council/documents/
--                vat-ii_const_19651118_dei-verbum_en.html  (same file as entry 10)
-- 14. Catechism of the Catholic Church 74-100
--     VERIFIED  vatican.va/archive/ENG0015/_INDEX.HTM  (navigate to Part One,
--     Section One, Chapter Two, Article 2: The Transmission of Divine Revelation)
-- 15. Irenaeus of Lyons, Against Heresies III.1-3 (selections)
--     VERIFIED  newadvent.org/fathers/0103301.htm  (chapter 1)
--     plus newadvent.org/fathers/0103302.htm and 0103303.htm
--     (Roberts-Rambaut trans., Ante-Nicene Fathers Vol. 1)
-- 16. Second Vatican Council, Dei Verbum 10
--     VERIFIED  vatican.va/archive/hist_councils/ii_vatican_council/documents/
--                vat-ii_const_19651118_dei-verbum_en.html  (same file as entry 10;
--     navigate to paragraph 10)
-- 17. Second Vatican Council, Lumen Gentium 25
--     VERIFIED  vatican.va/archive/hist_councils/ii_vatican_council/documents/
--                vat-ii_const_19641121_lumen-gentium_en.html
-- 18. Congregation for the Doctrine of the Faith, Donum Veritatis (sections 16-23)
--     VERIFIED  vatican.va/roman_curia/congregations/cfaith/documents/
--                rc_con_cfaith_doc_19900524_theologian-vocation_en.html
-- 19. Thomas Aquinas, Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3
--     VERIFIED  newadvent.org/summa/3001.htm  (q.1; q.2 at newadvent.org/summa/3002.htm;
--     English Dominican Province trans.)
-- 20. First Vatican Council, Dei Filius (chapter 3: On Faith)
--     VERIFIED  papalencyclicals.net/councils/ecum20.htm  (same canonical source
--     as entries 8 and 11)
-- 21. Catechism of the Catholic Church 142-175
--     VERIFIED  vatican.va/archive/ENG0015/_INDEX.HTM  (navigate to Part One,
--     Section One, Chapter Three: Man's Response to God)
--
-- ============================================================================
-- PHIL 501 UPDATES
-- ============================================================================

-- 1. Plato, Apology (selections)
update readings r
set reference_url_or_citation = 'Plato, Apology (selections). Benjamin Jowett translation, public domain. Free text: http://classics.mit.edu/Plato/apology.html . Recommended print edition: G. M. A. Grube trans., rev. C. D. C. Reeve, in Plato: Complete Works, ed. John M. Cooper (Hackett, 1997).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'The Philosophical Act'
  and r.title = 'Apology (selections)';

-- 2. Aristotle, Metaphysics I.1-2 (selections)
update readings r
set reference_url_or_citation = 'Aristotle, Metaphysics, Book I.1-2. W. D. Ross translation, public domain. Free text: http://classics.mit.edu/Aristotle/metaphysics.1.i.html . Recommended print edition: Joe Sachs trans., Aristotle''s Metaphysics (Green Lion Press, 1999), or W. D. Ross in The Complete Works of Aristotle, ed. Jonathan Barnes (Princeton, 1984).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'The Philosophical Act'
  and r.title = 'Metaphysics I.1-2 (selections)';

-- 3. Jacques Maritain, An Introduction to Philosophy, ch. 1 (selections)
-- UNVERIFIED: 20th-century work, in copyright, no canonical free source.
update readings r
set reference_url_or_citation = 'Jacques Maritain, An Introduction to Philosophy, ch. 1. Recommended print edition: E. I. Watkin trans. (Sheed & Ward / Rowman & Littlefield reprint). (No verified free source.)'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'The Philosophical Act'
  and r.title = 'An Introduction to Philosophy, ch. 1 (selections)';

-- 4. Aristotle, Metaphysics IV.1-3 (selections)
update readings r
set reference_url_or_citation = 'Aristotle, Metaphysics, Book IV.1-3. W. D. Ross translation, public domain. Free text: http://classics.mit.edu/Aristotle/metaphysics.4.iv.html . Recommended print edition: Joe Sachs trans., Aristotle''s Metaphysics (Green Lion Press, 1999), or W. D. Ross in The Complete Works of Aristotle, ed. Jonathan Barnes (Princeton, 1984).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'Being and First Principles'
  and r.title = 'Metaphysics IV.1-3 (selections)';

-- 5. Thomas Aquinas, De Ente et Essentia (sections 1-3)
update readings r
set reference_url_or_citation = 'Thomas Aquinas, De Ente et Essentia, sections 1-3. Joseph Kenny OP translation. Free text: https://isidore.co/aquinas/DeEnte&Essentia.htm . Recommended print edition: Armand Maurer trans., On Being and Essence (Pontifical Institute of Mediaeval Studies, 2nd ed. 1968), or Joseph Bobik, Aquinas on Being and Essence: A Translation and Interpretation (Notre Dame, 1965).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'Being and First Principles'
  and r.title = 'De Ente et Essentia (sections 1-3)';

-- 6. Aristotle, Metaphysics XII.1-5 (selections)
update readings r
set reference_url_or_citation = 'Aristotle, Metaphysics, Book XII.1-5. W. D. Ross translation, public domain. Free text: http://classics.mit.edu/Aristotle/metaphysics.12.xii.html . Recommended print edition: Joe Sachs trans., Aristotle''s Metaphysics (Green Lion Press, 1999), or W. D. Ross in The Complete Works of Aristotle, ed. Jonathan Barnes (Princeton, 1984).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'Natural Theology and the First Cause'
  and r.title = 'Metaphysics XII.1-5 (selections)';

-- 7. Thomas Aquinas, Summa Theologiae I, q.2, a.1-3
update readings r
set reference_url_or_citation = 'Thomas Aquinas, Summa Theologiae I, q.2, a.1-3 (on the existence of God). Fathers of the English Dominican Province, Second and Revised Edition 1920, public domain. Free text: https://www.newadvent.org/summa/1002.htm . Recommended print edition: Fathers of the English Dominican Province trans., Summa Theologica (Benziger / Christian Classics reprint).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'Natural Theology and the First Cause'
  and r.title = 'Summa Theologiae I, q.2, a.1-3';

-- 8. First Vatican Council, Dei Filius (chapter 4 selections)
update readings r
set reference_url_or_citation = 'First Vatican Council, Dogmatic Constitution Dei Filius, chapter 4 (On Faith and Reason), 24 April 1870. Free text: https://www.papalencyclicals.net/councils/ecum20.htm . Recommended print edition: Norman P. Tanner SJ ed., Decrees of the Ecumenical Councils, vol. 2 (Georgetown University Press / Sheed & Ward, 1990).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'Reason and the Preambles of Faith'
  and r.title = 'Dei Filius (chapter 4 selections)';

-- 9. John Paul II, Fides et Ratio 1-5 (selections)
update readings r
set reference_url_or_citation = 'John Paul II, encyclical letter Fides et Ratio, sections 1-5, 14 September 1998. Free text: https://www.vatican.va/content/john-paul-ii/en/encyclicals/documents/hf_jp-ii_enc_14091998_fides-et-ratio.html . Recommended print edition: Pauline Books & Media or Libreria Editrice Vaticana edition.'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'PHIL 501'
  and m.title = 'Reason and the Preambles of Faith'
  and r.title = 'Fides et Ratio 1-5 (selections)';

-- ============================================================================
-- THEO 510 UPDATES
-- ============================================================================

-- 10. Second Vatican Council, Dei Verbum (sections 1-6)
update readings r
set reference_url_or_citation = 'Second Vatican Council, Dogmatic Constitution Dei Verbum, sections 1-6 (Preface and chapter I, Revelation Itself), 18 November 1965. Free text: https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html . Recommended print edition: Austin Flannery OP ed., Vatican Council II: The Conciliar and Post Conciliar Documents (Costello / Liturgical Press).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Revelation and the Act of Faith'
  and r.title = 'Dei Verbum (sections 1-6)';

-- 11. First Vatican Council, Dei Filius (chapter 2 selections)
update readings r
set reference_url_or_citation = 'First Vatican Council, Dogmatic Constitution Dei Filius, chapter 2 (On Revelation), 24 April 1870. Free text: https://www.papalencyclicals.net/councils/ecum20.htm . Recommended print edition: Norman P. Tanner SJ ed., Decrees of the Ecumenical Councils, vol. 2 (Georgetown University Press / Sheed & Ward, 1990).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Revelation and the Act of Faith'
  and r.title = 'Dei Filius (chapter 2 selections)';

-- 12. Catechism of the Catholic Church 50-73
update readings r
set reference_url_or_citation = 'Catechism of the Catholic Church, paragraphs 50-73 (Part One, Section One, Chapter Two: God Comes to Meet Man). Free text: https://www.vatican.va/archive/ENG0015/__PE.HTM (paragraph 50 entry; navigate via https://www.vatican.va/archive/ENG0015/_INDEX.HTM for subsequent paragraphs). Recommended print edition: Catechism of the Catholic Church, 2nd ed. (Libreria Editrice Vaticana / USCCB).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Revelation and the Act of Faith'
  and r.title = 'Catechism of the Catholic Church 50-73';

-- 13. Second Vatican Council, Dei Verbum (sections 7-16)
update readings r
set reference_url_or_citation = 'Second Vatican Council, Dogmatic Constitution Dei Verbum, sections 7-16 (Chapter II: Handing on Divine Revelation, and Chapter III: Sacred Scripture, Its Inspiration and Divine Interpretation), 18 November 1965. Free text: https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html . Recommended print edition: Austin Flannery OP ed., Vatican Council II: The Conciliar and Post Conciliar Documents (Costello / Liturgical Press).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Tradition, Scripture, and the Rule of Faith'
  and r.title = 'Dei Verbum (sections 7-16)';

-- 14. Catechism of the Catholic Church 74-100
update readings r
set reference_url_or_citation = 'Catechism of the Catholic Church, paragraphs 74-100 (Part One, Section One, Chapter Two, Article 2: The Transmission of Divine Revelation). Free text: https://www.vatican.va/archive/ENG0015/_INDEX.HTM (navigate to Part One, Chapter Two, Article 2). Recommended print edition: Catechism of the Catholic Church, 2nd ed. (Libreria Editrice Vaticana / USCCB).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Tradition, Scripture, and the Rule of Faith'
  and r.title = 'Catechism of the Catholic Church 74-100';

-- 15. Irenaeus of Lyons, Against Heresies III.1-3 (selections)
update readings r
set reference_url_or_citation = 'Irenaeus of Lyons, Against Heresies, Book III, chapters 1-3. Alexander Roberts and William Rambaut translation, Ante-Nicene Fathers vol. 1, public domain. Free text: https://www.newadvent.org/fathers/0103301.htm (ch. 1), https://www.newadvent.org/fathers/0103302.htm (ch. 2), https://www.newadvent.org/fathers/0103303.htm (ch. 3). Recommended print edition: Dominic J. Unger trans., St. Irenaeus of Lyons: Against the Heresies, Book 3 (Ancient Christian Writers 64, Paulist Press, 2012).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Tradition, Scripture, and the Rule of Faith'
  and r.title = 'Against Heresies III.1-3 (selections)';

-- 16. Second Vatican Council, Dei Verbum 10
update readings r
set reference_url_or_citation = 'Second Vatican Council, Dogmatic Constitution Dei Verbum, section 10 (on the relationship of Sacred Tradition, Sacred Scripture, and the teaching office of the Church), 18 November 1965. Free text: https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html . Recommended print edition: Austin Flannery OP ed., Vatican Council II: The Conciliar and Post Conciliar Documents (Costello / Liturgical Press).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Magisterium and Theological Method'
  and r.title = 'Dei Verbum 10';

-- 17. Second Vatican Council, Lumen Gentium 25
update readings r
set reference_url_or_citation = 'Second Vatican Council, Dogmatic Constitution Lumen Gentium, section 25 (on the teaching office of bishops), 21 November 1964. Free text: https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html . Recommended print edition: Austin Flannery OP ed., Vatican Council II: The Conciliar and Post Conciliar Documents (Costello / Liturgical Press).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Magisterium and Theological Method'
  and r.title = 'Lumen Gentium 25';

-- 18. Congregation for the Doctrine of the Faith, Donum Veritatis (sections 16-23)
update readings r
set reference_url_or_citation = 'Congregation for the Doctrine of the Faith, Instruction Donum Veritatis (On the Ecclesial Vocation of the Theologian), sections 16-23, 24 May 1990. Free text: https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19900524_theologian-vocation_en.html . Recommended print edition: Austin Flannery OP ed., Vatican Council II: More Post Conciliar Documents (Costello / Liturgical Press).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'Magisterium and Theological Method'
  and r.title = 'Donum Veritatis (selections)';

-- 19. Thomas Aquinas, Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3
update readings r
set reference_url_or_citation = 'Thomas Aquinas, Summa Theologiae II-II, q.1, a.1-5 (on the object of faith) and q.2, a.1-3 (on the interior act of faith). Fathers of the English Dominican Province translation, public domain. Free text: https://www.newadvent.org/summa/3001.htm (q.1) and https://www.newadvent.org/summa/3002.htm (q.2). Recommended print edition: Fathers of the English Dominican Province trans., Summa Theologica (Benziger / Christian Classics reprint).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'The Act of Faith and the Obedience of Reason'
  and r.title = 'Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3';

-- 20. First Vatican Council, Dei Filius (chapter 3: On Faith)
update readings r
set reference_url_or_citation = 'First Vatican Council, Dogmatic Constitution Dei Filius, chapter 3 (On Faith), 24 April 1870. Free text: https://www.papalencyclicals.net/councils/ecum20.htm . Recommended print edition: Norman P. Tanner SJ ed., Decrees of the Ecumenical Councils, vol. 2 (Georgetown University Press / Sheed & Ward, 1990).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'The Act of Faith and the Obedience of Reason'
  and r.title = 'Dei Filius (chapter 3: On Faith)';

-- 21. Catechism of the Catholic Church 142-175
update readings r
set reference_url_or_citation = 'Catechism of the Catholic Church, paragraphs 142-175 (Part One, Section One, Chapter Three: Man''s Response to God). Free text: https://www.vatican.va/archive/ENG0015/_INDEX.HTM (navigate to Part One, Section One, Chapter Three). Recommended print edition: Catechism of the Catholic Church, 2nd ed. (Libreria Editrice Vaticana / USCCB).'
from modules m, courses c
where r.module_id = m.id
  and m.course_id = c.id
  and c.code = 'THEO 510'
  and m.title = 'The Act of Faith and the Obedience of Reason'
  and r.title = 'Catechism of the Catholic Church 142-175';

-- ============================================================================
-- PATCH COMPLETE
-- ============================================================================
-- Verification query (optional):
--   select c.code, m.title as unit, r.title, r.reference_url_or_citation
--   from readings r
--   join modules m on m.id = r.module_id
--   join courses c on c.id = m.course_id
--   where c.code in ('PHIL 501', 'THEO 510')
--   order by c.code, m.position, r.position;
-- ============================================================================
