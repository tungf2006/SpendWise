import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from '@/lib/supabaseClient'

const AuthContext = createContext({})

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const mountedRef = useRef(false)
  const currentUserIdRef = useRef(null)
  const requestIdRef = useRef(0)

  const fetchProfile = useCallback(async (currentUser) => {
    const requestId = ++requestIdRef.current

    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      let result = existingProfile

      if (!result) {
        const defaultName =
          currentUser.user_metadata?.full_name?.trim() ||
          currentUser.email?.split('@')[0] ||
          'Người dùng SpendWise'

        // Không ghi đè nếu một tiến trình khác vừa tạo hồ sơ.
        const { error: createError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: currentUser.id,
              full_name: defaultName,
            },
            {
              onConflict: 'id',
              ignoreDuplicates: true,
            }
          )

        if (createError) throw createError

        const { data: createdProfile, error: readError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (readError) throw readError
        result = createdProfile
      }

      if (
        mountedRef.current &&
        currentUserIdRef.current === currentUser.id &&
        requestIdRef.current === requestId
      ) {
        setProfile(result)
      }

      return result
    } catch (error) {
      console.error('Lỗi khi tải hồ sơ:', error)
      throw error
    } finally {
      if (
        mountedRef.current &&
        currentUserIdRef.current === currentUser.id &&
        requestIdRef.current === requestId
      ) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let profileTimer

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null
        const nextUserId = nextUser?.id ?? null
        const previousUserId = currentUserIdRef.current

        setUser(nextUser)

        // Với cùng tài khoản, không tải lại hồ sơ ở mỗi sự kiện làm mới token.
        if (nextUserId && nextUserId === previousUserId) return

        currentUserIdRef.current = nextUserId
        requestIdRef.current += 1

        if (profileTimer) clearTimeout(profileTimer)

        if (!nextUser) {
          setProfile(null)
          setLoading(false)
          return
        }

        setProfile(null)
        setLoading(true)

        // Để lời gọi Supabase khác chạy sau callback xác thực.
        profileTimer = setTimeout(() => {
          fetchProfile(nextUser).catch(() => {
            // fetchProfile đã ghi lỗi và kết thúc trạng thái loading.
          })
        }, 0)
      }
    )

    return () => {
      mountedRef.current = false
      currentUserIdRef.current = null
      requestIdRef.current += 1
      if (profileTimer) clearTimeout(profileTimer)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    // Sự kiện đăng xuất sẽ cập nhật user và profile.
  }

  const refreshProfile = async () => {
    if (!user) return null
    return fetchProfile(user)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)