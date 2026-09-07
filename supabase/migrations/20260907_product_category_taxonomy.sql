-- Reuse existing categories: rename matching rows, add missing names, recategorize only clearly wrong products.
-- Watches is preserved because Premium analog watch already has a valid category.

UPDATE public.categories SET name = 'Bags & Travel' WHERE name = 'Bags';
UPDATE public.categories SET name = 'Tech & Electronics' WHERE name = 'Tech accessories';
UPDATE public.categories SET name = 'Desk & Stationery' WHERE name = 'Stationery';
UPDATE public.categories SET name = 'Welcome Kits' WHERE name = 'Welcome kits';

INSERT INTO public.categories (name)
SELECT v.name
FROM (VALUES
  ('Hampers & Gift Sets'),
  ('Eco-Friendly Gifts'),
  ('Home & Lifestyle'),
  ('Awards & Recognition'),
  ('Other')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.name = v.name);

UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE name = 'Hampers & Gift Sets' LIMIT 1)
WHERE name IN ('Corporate gift hamper', 'Festival hamper crate')
  AND category_id = (SELECT id FROM public.categories WHERE name = 'Welcome Kits' LIMIT 1);

UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE name = 'Eco-Friendly Gifts' LIMIT 1)
WHERE name = 'Recycled tote'
  AND category_id = (SELECT id FROM public.categories WHERE name = 'Welcome Kits' LIMIT 1);

UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE name = 'Awards & Recognition' LIMIT 1)
WHERE name = 'Silver coin keepsake'
  AND category_id = (SELECT id FROM public.categories WHERE name = 'Welcome Kits' LIMIT 1);
