import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuthGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockAuthGetUser(...args)
    },
    from: (...args) => mockFrom(...args)
  }
}))

import {
  normalizeKeywords,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../categoryService.js'

describe('categoryService - UC10 & UC11 (R2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: 'user-001', email: 'test@spendwise.vn' } },
      error: null
    })
  })

  describe('normalizeKeywords (Chuẩn hóa từ khóa)', () => {
    it('chuyển chuỗi rỗng và khoảng trắng thành mảng rỗng []', () => {
      expect(normalizeKeywords('')).toEqual([])
      expect(normalizeKeywords('   ')).toEqual([])
      expect(normalizeKeywords(null)).toEqual([])
      expect(normalizeKeywords(undefined)).toEqual([])
      expect(normalizeKeywords(12345)).toEqual([])
    })

    it('tách chuỗi phân cách bởi dấu phẩy, trim, lowercase và loại bỏ chuỗi rỗng', () => {
      expect(normalizeKeywords('cafe, Tra Sua , , Momo ,   ')).toEqual(['cafe', 'tra sua', 'momo'])
      expect(normalizeKeywords('GRAB, BE, Gojek')).toEqual(['grab', 'be', 'gojek'])
    })

    it('chuẩn hóa mảng hỗn hợp (trim, lowercase, filter Boolean)', () => {
      expect(normalizeKeywords(['Cafe', '  ', '', 'Trà Sữa', null, 'MOMO '])).toEqual(['cafe', 'trà sữa', 'momo'])
    })
  })

  describe('getCategories (UC10)', () => {
    it('lấy tất cả danh mục sắp xếp theo tên', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'c1', name: 'Ăn uống' }, { id: 'c2', name: 'Lương' }],
          error: null
        })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await getCategories()
      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(mockQuery.order).toHaveBeenCalledWith('name', { ascending: true })
      expect(result.data).toHaveLength(2)
    })

    it('lọc danh mục theo type khi được truyền vào', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'c1', name: 'Ăn uống', type: 'expense' }],
          error: null
        })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await getCategories('expense')
      expect(mockQuery.eq).toHaveBeenCalledWith('type', 'expense')
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createCategory (UC10)', () => {
    it('tạo danh mục mới kèm từ khóa chuẩn hóa thành công', async () => {
      const created = {
        id: 'c-new',
        name: 'Nuôi thú cưng',
        type: 'expense',
        keywords: ['meo', 'cho', 'pate'],
        icon: 'tag',
        color: '#10B981'
      }

      const mockQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: created, error: null })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await createCategory({
        name: '  Nuôi thú cưng  ',
        type: 'expense',
        keywords: 'Meo, Cho, , pate ',
        color: '#10B981'
      })

      expect(mockQuery.insert).toHaveBeenCalledWith({
        user_id: 'user-001',
        name: 'Nuôi thú cưng',
        type: 'expense',
        keywords: ['meo', 'cho', 'pate'],
        icon: 'tag',
        color: '#10B981'
      })
      expect(result.data.id).toBe('c-new')
    })

    it('từ chối khi tên danh mục rỗng', async () => {
      const result = await createCategory({ name: '   ', type: 'expense' })
      expect(result.data).toBeNull()
      expect(result.error.message).toContain('Tên danh mục không được để trống')
    })
  })

  describe('updateCategory (UC11, R2 Bugfix SQL Type Mismatch)', () => {
    it('chuẩn hóa chuỗi rỗng keywords thành mảng rỗng [] để tránh lỗi SQL type mismatch', async () => {
      const updated = {
        id: 'c1',
        name: 'Ăn uống',
        keywords: []
      }

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updated, error: null })
      }
      mockFrom.mockReturnValue(mockQuery)

      // Khi người dùng xóa trắng ô từ khóa, input là chuỗi rỗng ""
      const result = await updateCategory('c1', {
        name: 'Ăn uống',
        keywords: ''
      })

      // Đảm bảo update truyền mảng rỗng [] thay vì chuỗi ""
      expect(mockQuery.update).toHaveBeenCalledWith({
        name: 'Ăn uống',
        keywords: []
      })
      expect(result.data.keywords).toEqual([])
    })

    it('whitelist các trường hợp lệ, từ chối tên rỗng, loại không hợp lệ và payload rỗng', async () => {
      const resNoId = await updateCategory('', { name: 'Danh mục' })
      expect(resNoId.error.message).toContain('Thiếu ID')

      const resEmptyName = await updateCategory('c1', { name: '  ' })
      expect(resEmptyName.error.message).toContain('Tên danh mục không được để trống')

      const resInvalidType = await updateCategory('c1', { type: 'bogus_type' })
      expect(resInvalidType.error.message).toContain('Loại danh mục không hợp lệ')

      const resDisallowed = await updateCategory('c1', { user_id: 'hacker-id', id: 'fake-id' })
      expect(resDisallowed.error.message).toContain('Không có thông tin hợp lệ')

      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const resUnauth = await updateCategory('c1', { name: 'Hợp lệ' })
      expect(resUnauth.error.message).toContain('chưa đăng nhập')
    })
  })

  describe('deleteCategory (UC11)', () => {
    it('xóa danh mục theo id và ràng buộc user_id thành công', async () => {
      const eqUserSpy = vi.fn().mockResolvedValue({ error: null })
      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ eq: eqUserSpy })
      }
      mockFrom.mockReturnValue(mockQuery)

      const result = await deleteCategory('c1')
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'c1')
      expect(eqUserSpy).toHaveBeenCalledWith('user_id', 'user-001')
      expect(result.error).toBeNull()
    })

    it('từ chối khi thiếu ID danh mục hoặc chưa đăng nhập', async () => {
      const result = await deleteCategory('')
      expect(result.error.message).toContain('Thiếu ID')

      mockAuthGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const resUnauth = await deleteCategory('c1')
      expect(resUnauth.error.message).toContain('chưa đăng nhập')
    })
  })
})
