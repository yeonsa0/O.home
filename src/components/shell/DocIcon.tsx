'use client';
// 브라우저 탭 아이콘 (v2.0 사용자 요청) — 디자인 탭에서 지정, 비우면 기본 아이콘.
//
// 서버 메타데이터(generateMetadata)로도 넣지만 그건 **저장소 주소일 때만** 가능하다.
// 로컬 모드에서는 참조가 파일 id라 서버가 알 수 없으므로 화면에서 붙여 준다.
// 그리고 Next는 src/app/favicon.ico를 자동으로 걸기 때문에, 그냥 <link>를 더하면
// 기본 아이콘이 남아 어느 쪽이 이길지 브라우저마다 달라진다 — 기존 것을 지우고 우리 것만 남긴다.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteSettings } from '@/lib/siteStore';
import { useBlobUrl } from '@/lib/blobStore';

const MARK = 'ohome-favicon';

export function DocIcon() {
  const [site, , loaded] = useSiteSettings();
  const url = useBlobUrl(site.favicon);
  const pathname = usePathname();

  useEffect(() => {
    if (!loaded) return;

    const apply = () => {
      const mine = document.querySelector<HTMLLinkElement>(`link[data-${MARK}]`);
      if (!url) {
        // 지정을 지웠으면 우리 것을 걷어내고 기본 아이콘을 돌려놓는다.
        // 지울 때 Next가 심어 둔 링크도 함께 없앴으므로, 새로고침 없이도 기본이 다시 보이게
        // 여기서 되살려 준다 (안 그러면 지운 직후 head에 아이콘 링크가 하나도 없다)
        if (mine) {
          mine.remove();
          if (!document.querySelector('link[rel~="icon"]')) {
            const back = document.createElement('link');
            back.rel = 'icon';
            back.href = '/favicon.ico';
            document.head.appendChild(back);
          }
        }
        return;
      }
      // Next가 다시 심어 놓은 기본 아이콘 링크 제거 (우리 것은 남긴다)
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach(l => {
        if (!l.hasAttribute(`data-${MARK}`)) l.remove();
      });
      if (mine) {
        if (mine.href !== url) mine.href = url;
        return;
      }
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = url;
      link.setAttribute(`data-${MARK}`, '');
      document.head.appendChild(link);
    };

    apply();
    // 페이지를 옮기면 Next가 head를 다시 그리며 기본 아이콘을 되돌려 놓는다 (제목과 같은 이유).
    // 이미 우리 값이면 아무것도 하지 않으므로 되풀이되지 않는다.
    const ob = new MutationObserver(apply);
    ob.observe(document.head, { childList: true, subtree: true });
    return () => ob.disconnect();
  }, [loaded, url, pathname]);

  return null;
}
