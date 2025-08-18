// src/app/lib/authUtils.ts

export interface UserAuthInfo {
    role: 'superAdmin' | 'regionAdmin' | 'regionStaff' | 'none';
    region: string | null;
}

export interface ParameterizedCondition {
    condition: string;
    values: any[];
}

export function getUserAuthInfo(userEmail: string): UserAuthInfo {
    const superAdmins = ['jdb@jdb.com'];
    const regionMap: { [key: string]: string } = {
        nowon: '노원',
        dobong: '도봉',
        sungbook: '성북',
        joongrang: '중랑',
        gangbook: '강북',
        dae: '대학',
        sae: '새신자',
    };

    if (superAdmins.includes(userEmail)) {
        return { role: 'superAdmin', region: null };
    }

    for (const key in regionMap) {
        if (userEmail.includes(key)) {
            const userRegion = regionMap[key];
            if (userEmail.includes('admin')) {
                return { role: 'regionAdmin', region: userRegion };
            } else {
                return { role: 'regionStaff', region: userRegion };
            }
        }
    }
    return { role: 'none', region: null };
}

// =================================================================
//     ↓↓↓ 아래 모든 함수의 'regionStaff' 로직을 수정했습니다 ↓↓↓
// =================================================================

export function getQueryConditionForUser(userEmail: string): string {
    const authInfo = getUserAuthInfo(userEmail);
    switch (authInfo.role) {
        case 'superAdmin':
            return '';

        // 지역 관리자와 지역 담당자의 조회 권한을 동일하게 설정
        case 'regionAdmin':
        case 'regionStaff':
            return ` AND (m_ind.지역 = '${authInfo.region}' OR m_tch.지역 = '${authInfo.region}')`;

        case 'none':
        default:
            return ' AND 1=0';
    }
}

export function getParameterizedQueryConditionForUser(
    userEmail: string,
    startingIndex: number = 1
): ParameterizedCondition {
    const authInfo = getUserAuthInfo(userEmail);
    switch (authInfo.role) {
        case 'superAdmin':
            return { condition: '', values: [] };

        case 'regionAdmin':
        case 'regionStaff':
            return {
                condition: `(m_ind.지역 = $${startingIndex} OR m_tch.지역 = $${startingIndex})`,
                values: [authInfo.region],
            };

        case 'none':
        default:
            return { condition: '1=0', values: [] };
    }
}

export function getMemberTableQueryCondition(
    userEmail: string,
    memberTableAlias: string,
    startingIndex: number = 1
): ParameterizedCondition {
    const authInfo = getUserAuthInfo(userEmail);
    switch (authInfo.role) {
        case 'superAdmin':
            return { condition: '', values: [] };
        case 'regionAdmin':
        case 'regionStaff':
            return {
                condition: `${memberTableAlias}.지역 = $${startingIndex}`,
                values: [authInfo.region],
            };

        case 'none':
        default:
            return { condition: '1=0', values: [] };
    }
}
