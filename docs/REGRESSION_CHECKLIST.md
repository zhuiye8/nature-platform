# 鍥炲綊妫€鏌ユ竻鍗曪紙鏈€灏忛棴鐜級

## A. 璐﹀彿涓庤鑹?1. 浣跨敤 `admin` 鐧诲綍銆?2. 璋冪敤 `GET /api/v1/auth/me`锛岀‘璁ゅ寘鍚?`ROLE_SUPER_ADMIN`銆?3. 浣跨敤闈炶秴绠¤处鍙风櫥褰曪紝纭涓嶅寘鍚?`ROLE_SUPER_ADMIN`銆?
## B. 鍥炴敹绔欐潈闄?1. 闈炶秴绠¤繘鍏モ€滃洖鏀剁珯鈥濋〉闈紝鎭㈠鎸夐挳搴旂鐢ㄣ€?2. 闈炶秴绠＄洿璋冩仮澶嶆帴鍙ｏ細搴旇繑鍥?`403`銆?3. 瓒呯鎵ц鎭㈠锛氭棤鍐茬獊搴旀垚鍔燂紱鏈?`contract_id + contract_year` 鍐茬獊搴旇繑鍥?`409`銆?
## C. 鐜板満娴嬭瘎瀹℃牳浜哄垎閰嶏紙瑙掕壊姹狅級
1. 杩涘叆鈥滅幇鍦烘祴璇勨€濓紝璋冪敤 `GET /api/v1/on-site-assessments/reviewer-candidates`銆?2. 鍝嶅簲搴斿寘鍚洓缁勬暟缁勶細
   - `techReviewers`
   - `contentReviewersTech`
   - `contentReviewersManagement`
   - `contentReviewersNetwork`
3. 鍓嶇鍥涗釜涓嬫媺搴斿垎鍒娇鐢ㄥ搴旀暟缁勶紝涓嶅彲娣风敤銆?4. 浠讳竴瑙掕壊鏈€夋椂鎻愪氦鍒嗛厤搴旇闃绘銆?
## D. 寰呭姙瀹℃壒鏉冮檺
1. 鏃犲鏍歌鑹茬敤鎴疯闂€滃緟鍔炲鎵光€濅腑鍚堝悓/椤圭洰瀹℃牳椤瑰簲鍙楅檺銆?2. `ROLE_REVIEWER` 鎴?`ROLE_SUPER_ADMIN` 鐢ㄦ埛鍙甯哥湅鍒板苟澶勭悊瀹℃牳銆?
## E. 鍩虹鏋勫缓涓庢祴璇?1. 鍚庣锛歚mvn -q test` 閫氳繃銆?2. 鍓嶇锛歚pnpm build` 閫氳繃銆?3. 鏂囨。妫€鏌ワ細`check_format_doc.py --mode changed --allow-missing-architecture` 閫氳繃銆?
