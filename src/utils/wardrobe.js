import { supabase } from './supabase';

const MAX_IMAGE_BYTES = 80000;

function toDb(item) {
  return {
    name: item.name,
    brand: item.brand || '',
    color: item.color || '',
    size: item.size || '',
    category: item.category,
    occasions: item.occasions || [],
    notes: item.notes || '',
    source_url: item.sourceUrl || '',
    image: item.image && item.image.length <= MAX_IMAGE_BYTES ? item.image : '',
    added_at: item.addedAt || Date.now(),
    sort_order: item.sort_order ?? null,
  };
}

function fromDb(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    color: row.color,
    size: row.size,
    category: row.category,
    occasions: row.occasions || [],
    notes: row.notes,
    sourceUrl: row.source_url,
    image: row.image,
    addedAt: row.added_at,
    sort_order: row.sort_order,
  };
}

export async function getItems() {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(fromDb);
}

export async function addItem(item) {
  const { data: { user } } = await supabase.auth.getUser();

  // New items prepend: find min sort_order and go one lower
  const { data: existing } = await supabase
    .from('wardrobe_items')
    .select('sort_order')
    .order('sort_order', { ascending: true })
    .limit(1);
  const minSort = existing?.[0]?.sort_order ?? 0;

  const { data, error } = await supabase
    .from('wardrobe_items')
    .insert({ ...toDb(item), user_id: user.id, sort_order: minSort - 1, added_at: Date.now() })
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function updateItem(id, patch) {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .update(toDb(patch))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function deleteItem(id) {
  const { error } = await supabase
    .from('wardrobe_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function reorderItems(orderedIds) {
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('wardrobe_items').update({ sort_order: index }).eq('id', id)
    )
  );
}
