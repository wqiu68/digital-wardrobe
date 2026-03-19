import { supabase } from './supabase';

// Ensure the current user has a profile row (safe to call multiple times)
export async function ensureProfile(user, displayName) {
  await supabase.from('profiles').upsert(
    {
      id: user.id,
      display_name: displayName || user.email?.split('@')[0] || '',
      email: user.email,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
}

// Find a user by email and send them a friend request
export async function sendFriendRequest(email) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, email')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (profileError || !profile) throw new Error('No account found with that email.');
  if (profile.id === user.id) throw new Error('You cannot add yourself.');

  // Check if a friendship already exists in either direction
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${profile.id}),` +
      `and(requester_id.eq.${profile.id},addressee_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'accepted') throw new Error('You are already friends.');
    if (existing.status === 'pending') throw new Error('A friend request is already pending.');
  }

  const { error } = await supabase.from('friendships').insert({
    requester_id: user.id,
    addressee_id: profile.id,
    status: 'pending',
  });
  if (error) throw error;
  return profile;
}

// Incoming pending requests (someone sent you a request)
export async function getPendingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, requester_id, created_at, requester:profiles!friendships_requester_id_fkey(display_name, email)')
    .eq('addressee_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  return (data || []).map(f => ({
    id: f.id,
    userId: f.requester_id,
    displayName: f.requester?.display_name,
    email: f.requester?.email,
    createdAt: f.created_at,
  }));
}

// Outgoing pending requests (you sent, awaiting response)
export async function getOutgoingRequests() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('friendships')
    .select('id, addressee_id, created_at, addressee:profiles!friendships_addressee_id_fkey(display_name, email)')
    .eq('requester_id', user.id)
    .eq('status', 'pending');
  if (error) throw error;
  return (data || []).map(f => ({
    id: f.id,
    userId: f.addressee_id,
    displayName: f.addressee?.display_name,
    email: f.addressee?.email,
    createdAt: f.created_at,
  }));
}

// Accepted friends
export async function getFriends() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id, requester_id, addressee_id,
      requester:profiles!friendships_requester_id_fkey(display_name, email),
      addressee:profiles!friendships_addressee_id_fkey(display_name, email)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
  if (error) throw error;
  return (data || []).map(f => {
    const isRequester = f.requester_id === user.id;
    const friend = isRequester ? f.addressee : f.requester;
    return {
      friendshipId: f.id,
      userId: isRequester ? f.addressee_id : f.requester_id,
      displayName: friend?.display_name || '',
      email: friend?.email || '',
    };
  });
}

// Accept or decline an incoming request
export async function respondToRequest(friendshipId, accept) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', friendshipId);
  if (error) throw error;
}

// Remove a friend (deletes the friendship row)
export async function removeFriend(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

// Fetch recent items from all accepted friends (for the feed)
export async function getFriendsFeed() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: friendships } = await supabase
    .from('friendships')
    .select(`
      requester_id, addressee_id,
      requester:profiles!friendships_requester_id_fkey(display_name),
      addressee:profiles!friendships_addressee_id_fkey(display_name)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (!friendships?.length) return [];

  const friends = friendships.map(f => {
    const isRequester = f.requester_id === user.id;
    return {
      userId: isRequester ? f.addressee_id : f.requester_id,
      displayName: isRequester ? f.addressee?.display_name : f.requester?.display_name,
    };
  });

  const friendIds = friends.map(f => f.userId);

  const { data: items, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .in('user_id', friendIds)
    .order('added_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  return (items || []).map(row => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    color: row.color,
    size: row.size,
    category: row.category,
    sourceUrl: row.source_url,
    image: row.image,
    addedAt: row.added_at,
    friendDisplayName: friends.find(f => f.userId === row.user_id)?.displayName || '',
    friendUserId: row.user_id,
  }));
}

// Fetch a friend's wardrobe items (allowed by updated RLS)
export async function getFriendItems(userId) {
  const { data, error } = await supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
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
  }));
}
