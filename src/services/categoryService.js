import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Danh mục thu/chi
 * Phụ trách: TV3 (Nguyễn Vũ Tấn Huy) - Nhóm chức năng CAT (UC10 - UC11)
 */

/**
 * Lấy tất cả danh mục (bao gồm danh mục hệ thống user_id = null và danh mục riêng của user) (UC10)
 * @param {'income' | 'expense' | null} type Lọc theo loại thu hoặc chi (tuỳ chọn)
 * @returns {Promise<{ data: any[], error: any }>}
 */
export async function getCategories(type = null) {
  try {
    let query = supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query
    return { data: data || [], error }
  } catch (err) {
    return { data: [], error: err }
  }
}

/**
 * Thêm danh mục tùy chỉnh cho người dùng (UC10)
 * @param {{ name: string, type: 'income' | 'expense', keywords?: string[], icon?: string, color?: string }} categoryData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createCategory(categoryData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const keywords = Array.isArray(categoryData.keywords) 
      ? categoryData.keywords 
      : (categoryData.keywords ? categoryData.keywords.split(',').map(s => s.trim().toLowerCase()) : [])

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: categoryData.name,
        type: categoryData.type,
        keywords,
        icon: categoryData.icon || 'tag',
        color: categoryData.color || '#10B981'
      })
      .select()
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Sửa thông tin danh mục tùy chỉnh (UC11)
 * Lưu ý: Chỉ sửa được danh mục có user_id = auth.uid()
 * @param {string} categoryId 
 * @param {{ name?: string, type?: 'income' | 'expense', keywords?: string[], icon?: string, color?: string }} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateCategory(categoryId, updates) {
  try {
    const formattedUpdates = { ...updates }
    if (updates.keywords && !Array.isArray(updates.keywords)) {
      formattedUpdates.keywords = updates.keywords.split(',').map(s => s.trim().toLowerCase())
    }

    const { data, error } = await supabase
      .from('categories')
      .update(formattedUpdates)
      .eq('id', categoryId)
      .select()
      .single()

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Xóa danh mục tùy chỉnh (UC11)
 * @param {string} categoryId 
 * @returns {Promise<{ error: any }>}
 */
export async function deleteCategory(categoryId) {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)

    return { error }
  } catch (err) {
    return { error: err }
  }
}
