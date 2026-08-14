-- ============================================================
-- Colores de categoría distinguibles.
--
-- La paleta original tenía tres cianes y tres violetas-rosas, y ningún tono
-- cálido. Salud (#d946ef) y Transporte (#8b5cf6) daban ΔE 1.3 en protanopia
-- (indistinguibles para daltonismo rojo-verde) y 14.1 en visión normal, por
-- debajo del piso de 15: costaba separarlos incluso viendo todos los colores.
-- Con puntitos sueltos en una lista no se notaba; en un gráfico por categoría
-- serían dos porciones iguales.
--
-- La paleta nueva pasa banda de luminosidad y contraste en modo claro y
-- oscuro, y sube el peor par a ΔE 7.5 en CVD y 17.0 en visión normal. El 7.5
-- queda en la banda que exige codificación secundaria: los gráficos llevan
-- etiqueta directa con el nombre de la categoría, no solo color.
--
-- `Otros` queda gris a propósito: el validador lo marca por croma baja, pero
-- un bucket "resto" gris es la convención correcta y no compite por identidad.
-- ============================================================

update categories set color = '#0d9488' where name = 'Supermercado' and color = '#14b8a6';
update categories set color = '#d97706' where name = 'Servicios'    and color = '#0ea5e9';
update categories set color = '#0284c7' where name = 'Transporte'   and color = '#8b5cf6';
update categories set color = '#8b5cf6' where name = 'Salud'        and color = '#d946ef';
update categories set color = '#ea580c' where name = 'Hogar'        and color = '#06b6d4';

-- Alquiler (#6366f1), Salidas (#ec4899) y Otros (#64748b) ya pasaban y no se tocan.
