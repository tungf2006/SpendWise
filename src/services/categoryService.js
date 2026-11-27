import { supabase } from '@/lib/supabaseClient'

/**
 * Service quản lý Danh mục thu/chi
 * Phụ trách: Nhóm phát triển SpendWise (Leader Tùng & TV3 Quốc) - Nhóm chức năng CAT (UC10 - UC11)
 */

/**
 * Chuẩn hóa mảng từ khóa danh mục (keywords)
 * Xử lý chuỗi rỗng "" -> [], tách dấu phẩy, trim, lowercase, loại bỏ rỗng
 * @param {string | string[] | null | undefined} keywords
 * @returns {string[]}
 */
export function normalizeKeywords(keywords) {
  if (!keywords) return []
  if (Array.isArray(keywords)) {
    return keywords
      .map((k) => (typeof k === 'string' ? k.trim().toLowerCase() : ''))
      .filter(Boolean)
  }
  if (typeof keywords === 'string') {
    return keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
  }
  return []
}

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
 * @param {{ name: string, type: 'income' | 'expense', keywords?: string[] | string, icon?: string, color?: string }} categoryData 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function createCategory(categoryData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const trimmedName = (categoryData?.name || '').trim()
    if (!trimmedName) {
      throw new Error('Tên danh mục không được để trống')
    }

    const categoryType = categoryData?.type === 'income' ? 'income' : 'expense'
    const keywords = normalizeKeywords(categoryData?.keywords)

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: trimmedName,
        type: categoryType,
        keywords,
        icon: categoryData?.icon || 'tag',
        color: categoryData?.color || '#10B981'
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
 * @param {{ name?: string, type?: 'income' | 'expense', keywords?: string[] | string, icon?: string, color?: string }} updates 
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function updateCategory(categoryId, updates) {
  try {
    if (!categoryId) {
      throw new Error('Thiếu ID danh mục cần cập nhật')
    }
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new Error('Dữ liệu cập nhật danh mục không hợp lệ')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const formattedUpdates = {}

    if ('name' in updates) {
      const trimmedName = (updates.name || '').trim()
      if (!trimmedName) {
        throw new Error('Tên danh mục không được để trống')
      }
      formattedUpdates.name = trimmedName
    }

    if ('type' in updates && updates.type !== undefined) {
      if (updates.type !== 'income' && updates.type !== 'expense') {
        throw new Error('Loại danh mục không hợp lệ')
      }
      formattedUpdates.type = updates.type
    }

    if ('icon' in updates && updates.icon !== undefined) {
      formattedUpdates.icon = updates.icon || 'tag'
    }

    if ('color' in updates && updates.color !== undefined) {
      formattedUpdates.color = updates.color || '#10B981'
    }

    if ('keywords' in updates && updates.keywords !== undefined) {
      formattedUpdates.keywords = normalizeKeywords(updates.keywords)
    }

    if (Object.keys(formattedUpdates).length === 0) {
      throw new Error('Không có thông tin hợp lệ để cập nhật')
    }

    const { data, error } = await supabase
      .from('categories')
      .update(formattedUpdates)
      .eq('id', categoryId)
      .eq('user_id', user.id)
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
    if (!categoryId) {
      throw new Error('Thiếu ID danh mục cần xóa')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Người dùng chưa đăng nhập')

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('user_id', user.id)

    return { error }
  } catch (err) {
    return { error: err }
  }
}
