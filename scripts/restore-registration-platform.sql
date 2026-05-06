-- ============================================================================
-- 一次性恢复脚本：注册平台 (registration_platform) 历史数据
--
-- 数据来源：scripts/_backup-source.sql
--          （生产清库前备份 backup-prod-before-reset-20260429-103325.sql）
-- 数据量：155 行（16 条 platform_name 为 NULL 的脏数据保留）
--
-- 处理：
--   1. ID 重新分配（不保留原 id 1-155，由 DB GENERATED ALWAYS AS IDENTITY 重新生成）
--   2. created_by / updated_by → 重映射为当前数据库中 zhangyusong（张渝松）的 user_id
--      （动态查询，dev/prod 通用）
--   3. created_at / updated_at / deleted / deleted_at 保留备份原值
--   4. 严格按 created_at 升序导入，让新 ID 反映原时间顺序
--
-- 安全检查：导入前要求 registration_platform 当前为空（避免重复导入）
--
-- 用法（dev/prod 通用）：
--   docker exec -i nature-postgres psql -U nature -d nature \
--     < scripts/restore-registration-platform.sql
--
-- 该脚本只能成功执行一次（INSERT 后表非空，再次执行会被安全检查拦截）。
-- ============================================================================

BEGIN;

-- ── 安全检查 ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM registration_platform;
  IF v_count > 0 THEN
    RAISE EXCEPTION '⚠ registration_platform 已有 % 行数据。如需重导，请先 TRUNCATE registration_platform RESTART IDENTITY CASCADE。', v_count;
  END IF;
END $$;

-- ── 临时表（与主表同结构但不含 id） ───────────────────────────────────────
CREATE TEMP TABLE _platform_import (
  platform_name VARCHAR(255),
  website_url VARCHAR(500),
  account VARCHAR(128),
  password VARCHAR(255),
  has_ca BOOLEAN,
  ca_expire_date DATE,
  ca_password VARCHAR(255),
  contact_name VARCHAR(64),
  contact_phone VARCHAR(32),
  remark TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ,
  updated_by BIGINT,
  updated_at TIMESTAMPTZ,
  deleted BOOLEAN,
  deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

-- ── 原始数据（id 列已移除，保留 16 个业务字段） ───────────────────────────
COPY _platform_import (
  platform_name, website_url, account, password, has_ca, ca_expire_date,
  ca_password, contact_name, contact_phone, remark, created_by, created_at,
  updated_by, updated_at, deleted, deleted_at
) FROM stdin;
\N	军队采购网	\N	\N	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	中银智采（中国银行）	57525	tpaknL7T	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://36.129.31.29:27443/seeyon/main.do?method=main	GYS047	Zky333333	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
中国石化承包商管理信息系统	https://scim.sinopec.com/home/#/portal	13338851202	Dzr@260319	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 03:26:56.43904+00	f	\N
南通醋酸纤维有限公司电子采购平台	https://ncfcinfo.jstcc.cn/secure-user-join	13338851202	Dzr12345!	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 03:27:20.468758+00	f	\N
兵器工业集团公司采购电子商务平台（阳光七采）	https://www.norincogroup-ebuy.com/	YZdzr123	YZdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 03:27:55.583368+00	f	\N
苏州地铁	http://zzcg.sz-mtr.com/	扬州大自然网络信息有限公司	Dzr123456@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:47:49.669148+00	f	\N
法大大	https://www.fadada.com/	13338851202		f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:48:04.731963+00	f	\N
圣元环保招标采购统一平台(友云采)	https://pur.yonyoucloud.com/chinasyep	13338851202	Dzr@12345	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:49:28.716542+00	f	\N
圣元环保招标采购统一平台(友云采)	https://new.ebidding.cecep.cn/	扬州大自然网络信息有限公司	YZdzr@123	f	\N				YZdzr@123	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:49:46.149745+00	f	\N
苏交科供应商协同平台 (SRM)	http://srm.jsti.com:30001/ecs-console/index.html#/login	15062122075	999999	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:50:10.593763+00	f	\N
邮E招电子招投标交易平台	www.youezhao.cn/		YZdzr@1234	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:50:54.529339+00	f	\N
中国烟草--中烟电子采购平台	cgjy.tobacco.com.cn/	wangli1202@yc	YZdzr@123	f	\N				用户名：wangli1202@yc	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:51:58.77839+00	f	\N
江苏翔晟信息技术股份有限公司--电子签章在线办理服务平台	https://www.share-sun.com/xsapply/admin/login.aspx?unitname=nantongggzy	15166793@qq.com	Dzr123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:52:54.397611+00	f	\N
连云港市第一人民医院电子化招标采购平台	http://zbb.lygyy.com.cn/home	13338851202	Yzdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:53:20.568391+00	f	\N
江苏海外电子招投标平台--江苏海外集团国际工程咨询有限公司	https://www.joccon.cn/	91321000759680427R	dzr1234@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:54:34.933374+00	f	\N
全国公共资源交易平台(安徽省·合肥市)--安徽合肥公共资源交易中心	https://ggzy.hefei.gov.cn/pgt/005004/zjzl.html			t	\N	123456				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:57:40.133951+00	f	\N
中国联通--通通慧购	www.ttmall.cn	yzdzr	Yzdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:58:40.209283+00	f	\N
徐工全球采购数字化平台	https://dsc.xcmg.com	S1333885120201	Yzdzr613656%	f	\N				新	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:59:08.509514+00	f	\N
中车戚墅堰机车车辆工艺研究所股份有限公司	https://srm.crrcqsyri.com:7910/	13338851202	Ab123456!	f	\N				中国中车	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:59:48.636552+00	f	\N
中车购2.0 产业链供应链数字化平台	https://www.crrcgo.cc/#/homePage	2000074846	yzdzr123@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:00:04.792513+00	f	\N
优质采--云采购平台	https://www.youzhicai.com/	13338851202	YZdzr123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:00:25.361456+00	f	\N
新奥能源控股有限公司	https://bid.zhixinzg.com/yonbip-cpu-nodesvr/h/ennenergy	13338851202	YZdzr@1234	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:01:00.91222+00	f	\N
智慧招采云平台	https://zcpt.ct-sec.com/procure/login	YZDZR	YZdzr123*	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:02:10.375262+00	f	\N
永卓采购协同门户	https://yzsrm.yong-gang.cn/	13338851202	Dzr123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:02:26.447591+00	f	\N
江苏招标JSTCC电子采购平台--一站式电子招标采购平台	https://cg.jstcc.cn/	15995137898	1!Chy811017	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:02:56.060233+00	f	\N
云采通	https://app.yuncaitong.cn/#/person/index	13338851202	YZdzr1234@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:03:31.692731+00	f	\N
电力集采招标网	www.dljczb.com	dzr2025	YZdzr1234@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:03:53.100425+00	f	\N
石化e签	https://esign.sinopec.com/#/index	YZdzr2025	YZdzr1234@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:04:16.417875+00	f	\N
江苏省交通运输厅限额以下分散采购与监管系统	http://218.2.208.150:65429	扬州大自然网络信息有限公司	YZdzr1234@	t	2026-08-01	00000000			江苏省交通运输厅限额以下分散采购与监管系统\n法人章、公章密码均为00000000（8个0）\n蓝色（江苏翔晟信息）\n	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:08:16.656248+00	f	\N
供应商服务门户（南瑞）	http://srmzc.sgepri.sgcc.com.cn/gys-portal/index.html#	13390619053	Yzdzr0702@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:09:57.139089+00	f	\N
中信泰富特钢集团股份有限公司--供应商协同平台	https://beps.citicsteel.com:58080/beps/login.jsp	L0019085	Yzdzr250707@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:09:40.441641+00	f	\N
驻马店市政府采购电子商城	https://zmd.zmddzsc.cn/	91321000759680427R	849586	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:10:14.026682+00	f	\N
国家电网有限公司--电工交易专区	https://sgccetp.com.cn/isc/newlogin.html	91321000759680427R	77c7kZTh#L	t	2027-01-15	808371			CA用“UTC”那个，CA密码同国家电网有限公司电子商\n	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:10:54.646722+00	f	\N
南京等保管理平台	http://dbba.njga.gov.cn:10002	13338851202	Xx223322	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:11:10.248957+00	f	\N
e签宝	https://h5.esign.cn/usercenterFront/login/web?session=224ff349-cee1-4398-882a-d1e3f16a13e0	13338851202	Dzr123456!	f	\N	123456				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:11:27.382564+00	f	\N
江苏天源智慧采购平台--国网江苏招标有限公司	https://bid.js.sgcc.com.cn/tyzb/tyzb2.0/fwdt/index.html#/login	13338851202	Dzr@20250618	t	2027-01-15	808371			CA用“UTC”那个，CA密码同国家电网有限公司电子商	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:14:04.91829+00	f	\N
苏州银行采购管理系统（苏州银行电子采购管理平台）	https://pcms.suzhoubank.com/szcgpt/	91321000759680427R	nongyu67298?	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:14:41.917356+00	f	\N
\N	\N	91321000759680427R	a^57@ujF#kk	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://hysrm.hanyun	13338851202	YZdzr250519@	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	http://218.3.161.98:28001 	DZR1234	DZR123456@ssw0rd	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	手机APP	\N	\N	f	\N	\N	\N	\N	应用口令：yzdzr	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://logo.ibuy.ccb.com/member/login/executeLogin.htm?isInlineUser=1&no_sitemesh	\N	DZR123456@ssw0rd	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
开迈斯	http://inquiry.camsnetec.com:89/wui/index.html#/?logintype=2	U00739	YZdzr250604	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:16:28.444338+00	f	\N
中国石油招标中心	https://www2.cnpcbidding.com/#/wel/index	yzdzr250527	YZdzr250528@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:18:14.894463+00	f	\N
中航工业电子采购平台	https://www.eavic.com/rest/index	yz_dzr19990712	YZdzr250527@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:18:31.019453+00	f	\N
全国一体化在线政务服务平台--安徽政务服务网--统一认证中心	https://sso.ahzwfw.gov.cn/uccp-server/login?appCode=55bee510abb44301805c29cba9851c1b	ohwmrfyyl	YZdzr20250523	f	\N		谢宝建	13338851759	选“法人用户”登录	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:19:57.861762+00	f	\N
鹏力科技集团ERP管理系统	http://221.226.74.198:9090/login	S00010449	YZdzr1234#	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:20:14.824862+00	f	\N
泰州市交通产业集团阳光采购平台	https://ygcg.tzjtcyjt.com/fore/home/#/	15195276299	YZdzr12345@YZdzr12	f	2026-05-20	12345678				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:20:31.676793+00	f	\N
易智采招标采购网	http://www.ezczb.com	扬州大自然网络信息有限公司	YZdzr250519@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:21:04.96552+00	f	\N
浩鲸科技--鲸采SRM系统	https://srm.iwhalecloud.com/spa/custom/static/index.html#/main/cs/app/6a5f32e53508414e98167de900834815_SingleEditE9NewLogin?_key=d74kin	dzr2025513	YZdzr250513@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:21:27.894447+00	f	\N
南京鼓楼医院电子化采购平台	https://cgpt.njglyy.com:6443/home	13338851202	YZdzr250506@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:21:45.821876+00	f	\N
南京中医药大学采招网	https://ztb.njucm.edu.cn/login/login-pub.jsf?loginType=seller	yzdzr0506	YZdzr250506@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:22:29.16097+00	f	\N
南京市等保测评监管平台	https://wadbkq.njga.gov.cn/login?redirect=%2Fhome	YZDZR123		f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:22:46.283698+00	f	\N
长安马自达SRM平台	https://srm.changan-mazda.com.cn:8020/	22080937	DZR2024@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:23:01.202677+00	f	\N
国铁采购平台	https://cg.95306.cn/index	YZdzr250417	YZdzr87590132@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:23:30.23609+00	f	\N
泰兴市人民医院招标采购管理平台	http://zbcg.jstxry.com	扬州大自然网络信息有限公司	Dzr@12345	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:23:56.693435+00	f	\N
招商局集团电子招标采购交易平台	https://dzzb.ciesco.com.cn/	扬州大自然2025年	YZdzr250401@	t	2026-04-02	123456			两个CA，一个公司名称CA，一个法人CA，法人CA无法登录。	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:24:18.722221+00	f	\N
中远海运重工有限公司--电子采购平台	https://ep.chi-coscoshipping.com:8001/	DZR123	Dzr123！@#	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:27:11.385584+00	f	\N
烽火众智--电子采购平台	http://eps.fhzz.com.cn/	yzdzr123	YZdzr123	f	\N				商务联系人：谢宝建	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:27:33.545848+00	f	\N
电子保函（保险）平台	https://jsdzbh.com/login	扬州大自然网络信息有限公司	YZdzr1234#	f	\N				可用于江苏省政府采购网、苏采云项目的电子保函申请	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:27:57.244531+00	f	\N
九翊供应商平台	http://183.134.62.137:7774/#/supplier-portal/notice		Dzr123123.	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:28:18.929555+00	f	\N
中国一汽电子招标采购交易平台	https://etp.faw.cn/	YZDZRWL	YZDZRWL	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:28:36.694741+00	f	\N
无锡市公共资源交易服务中心有限公司招投标业务管理系统	https://www.wxcq.com.cn:9142/TPBidder/memberLogin			f	\N				江苏乐思：\n登录名：江苏乐思信安技术有限公司\n密码：JSlsxa041205\nCA密码：654123	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:29:55.419409+00	f	\N
中储粮服务网	https://fwgs.sinograin.com.cn/portal	Yzdzr123	Yzdzr123456@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:31:38.747413+00	f	\N
中汽创智费控与资产管理系统	http://58.212.207.240:8008/Application/CUVENDOR	daziran	z7YM$bBc	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:33:13.574028+00	f	\N
航天科工集中采购平台	https://www.e-casic.com/	YZDZRWLXX	YZdzr123@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:33:34.777649+00	f	\N
江苏省服务类网上商城（苏服采）	https://js.fwgov.cn	yzdzr20230821		f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:35:09.709983+00	f	\N
中国石化--建设工程电子招标投标交易平台	https://ebidding.sinopec.com/v3/portal/#/	YZDZR	YZxytd@ztb169	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:35:31.272809+00	f	\N
国家电网有限公司电子商务平台（ECP）--国家电网新一代商务平台	https://ecp.sgcc.com.cn/ecp2.0/portal/#/	91321000759680427R	T*5862441	t	2027-01-15	808371			CA（UTC那个）密码：808371	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:36:06.321182+00	f	\N
深圳能源电子招标投标平台	https://zb.sec.com.cn/	YZDZR1234 	YZdzr1234#	t	\N	12345678				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:36:22.476866+00	f	\N
中国电建工程--服务供应商	https://bid.powerchina.cn/Contractor	扬州大自然网络信息有限公司	DZr@1234567	f	\N				新系统“中国电建采购招标数智化平台”	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:37:25.886478+00	f	\N
光大环境招标采购电子交易平台	zcpt.cebenvironment.com.cn	gys_123z	Dzr240319.	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:38:28.523453+00	f	\N
中天钢铁集团--中天钢铁供应链管理平台	 http://srm.zt.net.cn/login1	91321000759680427R	YZdzr123@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:38:49.944601+00	f	\N
航天电子采购平台	www.ispacechina.com	DZR123456	Dzr@2026323	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:39:11.418667+00	f	\N
首创环保电子商务平台“e精采”	https://ecp.capitalwater.cn/ 	DZR123456	Dzr123456789	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:39:39.56124+00	f	\N
泰州市数字化招标采购平台	https://zbcg.tzdig.cn/	13338851202	Dzr2025.	t	2027-04-10	123456				17	2026-04-09 12:00:39.852531+00	17	2026-04-13 02:47:13.888566+00	f	\N
\N	http://cg.czrbzb.com/cg/reg.php	YZDZR2023	YZDZR2023	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://ebidding.sinopec.com/TPWeb4AAA/	yzdzr	yzdzr@123	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://www.szecp.com.cn/（https://szecp.crc.com.cn）	扬州大自然网络信息有限公司	DZRdzr147	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://www.ccgp-jiangsu.gov.cn:5009/zfcgzx/login?bs=5	YZDZR123	DZRdzr147	t	\N	123456	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	\N	13338851202	YZdzr1234	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://www.isccc.gov.cn/index.shtml	yzdzr2021	2021@YZdzr	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://www.cecbid.org.cn/auth/login	yzdzrNature	yzdzr@1234	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
\N	https://papms.pa18.com	FXXX20200909	dzr123456	f	\N	\N	\N	\N	\N	17	2026-04-09 12:00:39.852531+00	\N	2026-04-09 12:00:39.852531+00	f	\N
南京水务集团有限公司招投标交易平台	ztb.jlwater.com:8008/ztbweb/	W91321000759680427R	Yz@123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:42:11.424242+00	f	\N
（苏采云--政府采购一体化）江苏政府采购--江苏政府购买服务信息平台	http://jszfcg.jsczt.cn/jszc/workbench/supplier	13338851202	YZdzr1234#	t	2026-10-13	111111				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:41:40.851343+00	f	\N
江苏省港口集团电子招标采购平台	http://ecg.portjs.cn:20909/#/portal?index=0	扬州大自然网络信息有限公司	DZr@123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:42:42.674694+00	f	\N
国能e购	https://www.neep.shop/	wodecuo	DZr@123456\\-@	f	\N				账号：xbj20240521\n\n大自然国能E招平台账号：\n13338851759	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:42:55.058946+00	f	\N
CFCA数字证书在线受理平台	http://chnenergybidding.cedex.cn	yzdzr1999712	DZr@123456	f	\N				服务于“国能e招”	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:43:57.143083+00	f	\N
云采链线上采购一体化平台	http://www.choicelink.cn/	yzdzr	yzdzr2020	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:44:42.72207+00	f	\N
东和集团国有企业交易平台	http://dhztb.jinzhaocai.com/main	yznature	dzr123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:45:03.189134+00	f	\N
招商银行采购管理平台	http://xcg-nginx.paas.cmbchina.com/seller/#/login?redirect=%2Fdashboard	yznature	DZr@123456	t	2026-12-17	dzr123			主账户\n账号：91321000759680427R\n密码：Dzr@20260306	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:45:41.265126+00	f	\N
中核集团电子采购平台（中国核工业集团有限公司）	https://www.cnncecp.com/	91321000759680427R	Dzr@250530	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:46:03.169527+00	f	\N
中国电力设备信息网--国家电投电子商务平台--电能e招采平台	https://ebid.espic.com.cn/	YZDZR123	Gnez202625@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:53:39.96314+00	f	\N
京东招采供应商协同平台	https://proc-bidding.jd.com/home	yzdzr-2023	yzdzr123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:53:55.473025+00	f	\N
中通服供应链股份有限公司--电子招标系统（链捷招）	https://jszb.chinaccsscm.cn/ztf/Index.jsp	91321000759680427R	YZdzr@dzr25	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:56:48.072365+00	f	\N
东部机场集团电子采购平台	https://bid.easternairports.com:1443/	91321000759680427R	dzr12345	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:57:06.000626+00	f	\N
通威新能源招标管理平台	http://supplier.tongwei.com/	13338851759	de3sp9	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:57:19.296165+00	f	\N
浪潮电子采购平台	scs.inspur.com	yznature	YZdzr87590132@	f	\N	yznature				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:57:38.077301+00	f	\N
徐工全球数字化供应链系统	http://xdsc.xcmg.com:8985/#/	yzdzr1234	B613656%	f	\N				旧系统 不用	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:58:01.098071+00	f	\N
中化招标电子招投标平台	e.sinochemitc.com	yzdzr1234	YZdzr87590375	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:58:25.891288+00	f	\N
山西省招标投标协会--山西招标采购服务平台	https://www.sxtba.com/home	yzdzr321	YZdzr123@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:58:38.01677+00	f	\N
常州正衡招投标有限公司	http://cg.czzhzb.com/	YZDZR2021	YZDZR2021	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:59:34.23671+00	f	\N
中招联合招标采购网	http://www.365trade.com.cn/	13338851202	YZdzr1234@	t	\N	19990712				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:00:49.276334+00	f	\N
招投标网	http://www.infobidding.com/index.html	yzdzr123	YZdzr1234@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:02:19.83158+00	f	\N
中国三峡电子采购平台	https://eps.ctg.com.cn/	13338851759	YZdzr1234@	t	\N	YZdzr1234@4321				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:02:41.355899+00	f	\N
竞采星	https://www.easyjcx.com/#/index	yzdzr1234	yzdzr4321@	f	\N	123456	王莉	13338851202		17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:02:54.437903+00	f	\N
中国电信阳光采购网	https://caigou.chinatelecom.com.cn/ctsc-portal/ctscPortal?redirect=%2FHomePage	1230494	YZdzr1234@	f	2026-09-25	12345678				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:03:06.845076+00	f	\N
江苏交通控股有限公司电子采购平台	https://zbcg.jchc.cn/login?ty=3	扬州大自然网络信息有限公司	YZdzr1234@	f	\N	yokl35214				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:03:39.442209+00	f	\N
新盛集团招标采购	http://zc.xstzgs.com:18380/	扬州大自然网络信息有限公司	yzdzr1234	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:03:55.102485+00	f	\N
（e交易）全国产权交易中心政府企业招标采购信息管理平台	www.ejy365.com	扬州大自然网络信息有限公司	 YZdzr1234	t	2026-07-17	123456				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:05:25.224987+00	f	\N
中国华能电子商务平台	http://ec.chng.com.cn/ecmall/	yzdzr123	Yzdzr@1233211	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:30:50.423516+00	f	\N
中国华电集团电子商务平台	https://www.chdtp.com/	dzr1234	yzdzr66876	f	\N		蔡海勇	15995137898		17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:31:06.150427+00	f	\N
SCM供应链管理系统	http://www.jicaibao.com	yzdzr	Yzdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:32:05.369889+00	f	\N
江苏省招标中心有限公司	https://www.jstcc.cn/	chy811017		f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:32:18.437255+00	f	\N
解放号	nj.jfh.com	15062807437	0905luyb	t	\N	dzr123				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:32:35.617291+00	f	\N
南京市政府采购供应商诚信档案管理系统	http://180.101.238.212:8280/hodeframe2018_cxda/login.action?page=1	13004313133	dzr123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:33:00.849878+00	f	\N
国信招标集团	https://ebid.gxzb.com.cn/	yzdzr	yzdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 03:26:09.361532+00	f	\N
四川轩辕电子招标平台	http://180.76.195.209/login.html	扬州大自然网络信息有限公司	yzdzr123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 03:26:39.4653+00	f	\N
国家管网（管网 e 通）统一登录门户	https://eiam.pipechina.com.cn:30007/authn/index.html?service=https%3A%2F%2Feiam.pipechina.com.cn%3A30007%2Fportal%2Fauth%2FcasLogin	13338851202	YZdzr123@	f	\N				141（国家管网）和102（国家管网数字供应链平台），已统一由该网址登录。	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:47:39.901669+00	f	\N
天合富家--金蝶云苍穹	https://zhsrm.trinapower.com/ierp/index.html?accountId=1433416885638004736&appNumber=srm&formId=srm_portal&userId=guest	13338851759	@Yznature0514	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:52:26.601578+00	f	\N
新疆阳光采购服务平台交易系统	http://www.xjygcg.com/TPBidder/memberLogin	扬州大自然网络信息有限公司	12345678.A	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:54:04.836102+00	f	\N
皖能数采·安徽省能源集团有限公司招标采购数字化管理系统	https://tab.wenergy.com.cn/bszn/bszn.html	扬州大自然网络信息有限公司	YZdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:58:02.321513+00	f	\N
全国公共资源交易平台(河南省·郑州市) --郑州市公共资源交易中心	https://zzggzy.zhengzhou.gov.cn/	扬州大自然网络信息有限公司	dzr123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 05:59:24.876245+00	f	\N
扬子石化一巴斯夫有限责任公司--电子采购系统	https://srm.basf-ypc.com.cn/srm/	1059064514@qq.com		f	\N		田焱鑫		田焱鑫邮箱	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:01:18.115746+00	f	\N
海门区限额以下公共资源智慧交易及一体化监管平台	http://xe.hmdzzw.cn/ 	扬州大自然网络信息有限公司	YZdzr202508@	f	\N				海门区限额以下公共资源智慧交易及一体化监管平台	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:01:53.605444+00	f	\N
淮河能源--淮南矿业集团电子采购平台V1.0	https://www.hhnycg.com/index.html#/ls/do-en?orgName=%E6%89%AC%E5%B7%9E%E5%A4%A7%E8%87%AA%E7%84%B6%E7%BD%91%E7%BB%9C%E4%BF%A1%E6%81%AF%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8&orgLicenceCode=91321000759680427R&regWay=1&regType=1&addLi=1	yzdazrzr	YZdzr20250523	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:07:57.225967+00	f	\N
中国能建--中国能建电子采购平台--中国能源建设集团（股份）有限公司	https://ec.ceec.net.cn/	13338851202	tK2^nY2~mQ4	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:13:24.914028+00	f	\N
申能股份数字化集采平台	https://snjcsup.shenergy.net.cn/shenergyPortal/	yznature123	Yznature123!	f	\N				登录的同时需要插上E签宝的CA	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:15:02.242257+00	f	\N
运达股份采购管理平台（数智采购慧联内外一-运达股份采购管理平台）	https://srm.windeyenergy.com/	3000014075	Windey@2025	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:15:35.97257+00	f	\N
中国邮政电子采购与供应平台V2.0	https://cg.11185.cn/	YZdaziran	uiop#ASDF11	f	\N		13338851202			17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:15:51.43315+00	f	\N
中国石油电子招标投标交易平台	https://ebidmanage.cnpcbidding.com/bidder/ebid/base/login.html	yzdzr250527	YZdzr250527@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:18:47.76764+00	f	\N
国家管网	https://iscmdzzb.pipechina.com.cn:8081/web-login/index.html#/login	13338851202	YZdzr0527@	f	\N				已同步至“国家管网--管网e通”“https://eiam.pipechina.com.cn:30007/authn/index.html?service=https%3A%2F%2Feiam.pipechina.com.cn%3A30007%2Fportal%2Fauth%2FcasLogin”	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:19:32.510022+00	f	\N
国家电网有限公司--电子商务平台--国网绿链云网	https://www.ecpgsc.com/#/homePage/home	91321000759680427R	f^5@1@DKP#hy	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:22:13.476036+00	f	\N
河南省公共资源交易中心	http://hnsggzyjy.henan.gov.cn/	扬州大自然网络信息有限公司	YZdzr250422	t	2026-04-23	111111			两个CA，一个公司名称CA，一个法人CA，法人CA无法登录。	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:23:16.590478+00	f	\N
中国融通电子商务平台门户网站	https://www.ronghw.cn/	YZdzr25325	YZdzr@250325	t	2026-04-01	92377211	王莉	13338851202	项目投标选择“李旭”账号\n账号：YZdzr250403\n密码：YZdzr250403@	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:25:16.828809+00	f	\N
无锡华光环保能源集团股份有限公司	https://hgcg.hghngroup.com/web-login/index.html#/login	15150805875	Yzdzr.20241031	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:29:07.675639+00	f	\N
大唐电子商务平台	http://www.cdt-ec.com	lz12345678	YZdzr12345@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:33:51.738673+00	f	\N
江苏省人民医院	https://vpn.jsph.org.cn:14433			f	\N				第一步：江苏省人民医院VPN账户https://vpn.jsph.org.cn:14433\n账号：13338851202\n密码：dzr123456@\n第二步：江苏省人民医院供应商服务平台http://172.16.4.79:8066/tender/dzcg/toLogin\n13338851202，123456789	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:34:38.968925+00	f	\N
国家管网数字供应链平台	https://iscm.pipechina.com.cn:8443/home/	yzdzr20230402	DZr@12345678	f	\N				账号密码对应：国家供应链认证机构（信用认证\n手机号：13338851202\n密码：YZdzr123）\n	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:37:57.659872+00	f	\N
中国中煤供应链平台	http://ego.chinacoal.com/#/	yzdzr1999712	DZr@19997120704	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:40:03.472752+00	f	\N
徐矿招标与采购网	http://bid.xkjt.net/bid_ol/home/index.do	yzdzr1999712	DZr@123456	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:40:19.487231+00	f	\N
江苏省环保集团有限公司--数字化采购平台(电子采购平台)	http://221.6.38.162:8081/portal?index=0	扬州大自然网络信息有限公司	YZnature123!	f	\N				翔晟电子签章：\n系统登录名：15166793@qq.com\n密码：YZdzr19990712\n应用口令：dzr990712	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:40:43.75503+00	f	\N
国能e招	www.chnenergybidding.com.cn	yzdzr1997712	YZdzr@7@1@2	t	\N	yzdzr123			大自然CA：\n账号：YZDZR123\n密码：yzdzr123\n	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:44:23.295195+00	f	\N
国电南自采购协同平台	https://srm.sac-china.com/	V16120161	yzdzr@123	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:49:01.369821+00	f	\N
通购网--中国通号电子商务平台	https://www.crscec.com/biddingManager/	yznature	YZdzr1234@	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:55:58.572719+00	f	\N
南通市公共资源交易平台--南通市政府采购网	http://zfcg.nantong.gov.cn/			t	2025-11-30	123456			掌易捷APP账号：9mesz5qt\n掌易捷APP密码：NTjy1234\n标证通APP账号：13338851202\n标证通APP密码：YZdzr4321	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:56:20.294655+00	f	\N
中国移动采购与招标网	https://b2b.10086.cn/b2b/main/preIndex.html	B2B-KINGXIN@HQ.CMCC	DZr@2022	f	\N		王莉			17	2026-04-09 12:00:39.852531+00	17	2026-04-10 06:59:17.53736+00	f	\N
丹阳教育技术装备管理中心网上竞价--物资采购竞价平台	http://www.dyjyzbw.cn:90/wui/index.html#/?logintype=1&_key=n8o75w       http://www.dyjyzbw.cn/	扬州大自然网络信息有限公司	yz_Nature	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:01:58.786177+00	f	\N
中国海洋石油集团有限公司采办业务管理与交易系统	https://buy.cnooc.com.cn/cbjyweb/	s_yzdzrwl	5$gyxO1N	f	\N				原来（不用）\n用户名：s_yzdzr1997， \n密码：YZdzr123	17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:04:18.920774+00	f	\N
中国联通合作方门户	http://www.cuecp.cn/portal/index.jhtml	ex-yangfan378	YZDZr.1362	f	\N	36Y@Bj*x				17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:31:51.656384+00	f	\N
常州市城投建设工程招标有限公司	http://www.czctzb.com/login.html	扬州大自然网络公司	6661610@dd	f	\N					17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:32:48.322003+00	f	\N
中国建材集团采购平台	https://c.cnbm.com.cn/cnbm-portal-view/#/login	13338851202	YZdzr123	f	\N		王莉	13338851202		17	2026-04-09 12:00:39.852531+00	17	2026-04-10 07:33:15.572342+00	f	\N
测试平台	测试	测试	111	f	2026-04-21	111	111	111	111	45	2026-04-10 08:58:10.849554+00	45	2026-04-10 08:58:44.789486+00	t	2026-04-10 08:58:44.789+00
\.

-- ── 重映射 created_by / updated_by 为 zhangyusong（dev/prod 通用） ────────
DO $$
DECLARE
  v_user_id BIGINT;
BEGIN
  SELECT id INTO v_user_id FROM user_account WHERE username = 'zhangyusong';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '⚠ 未找到 username=zhangyusong 的用户，请先执行 seed-prod-staff.sql 等用户初始化';
  END IF;
  UPDATE _platform_import
    SET created_by = v_user_id,
        updated_by = CASE WHEN updated_by IS NOT NULL THEN v_user_id ELSE NULL END;
  RAISE NOTICE 'created_by/updated_by 已重映射为 zhangyusong (user_id=%)', v_user_id;
END $$;

-- ── 主表导入（id 自动生成，按 created_at 升序保持原始时间顺序） ───────────
INSERT INTO registration_platform (
  platform_name, website_url, account, password, has_ca, ca_expire_date,
  ca_password, contact_name, contact_phone, remark, created_by, created_at,
  updated_by, updated_at, deleted, deleted_at
)
SELECT
  platform_name, website_url, account, password, has_ca, ca_expire_date,
  ca_password, contact_name, contact_phone, remark, created_by, created_at,
  updated_by, updated_at, deleted, deleted_at
FROM _platform_import
ORDER BY created_at, ctid;

-- ── 验证 ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total INT; v_named INT; v_active INT; v_deleted INT; v_minid INT; v_maxid INT;
BEGIN
  SELECT COUNT(*),
         COUNT(platform_name),
         COUNT(*) FILTER (WHERE deleted = FALSE),
         COUNT(*) FILTER (WHERE deleted = TRUE),
         MIN(id), MAX(id)
    INTO v_total, v_named, v_active, v_deleted, v_minid, v_maxid
    FROM registration_platform;

  RAISE NOTICE '═══ 注册平台数据恢复完成 ═══';
  RAISE NOTICE '总行数: %（期望 155）', v_total;
  RAISE NOTICE '有名称: %（期望 139）', v_named;
  RAISE NOTICE '未删除: %（期望 154）', v_active;
  RAISE NOTICE '已软删除: %（期望 1）', v_deleted;
  RAISE NOTICE 'ID 范围: % - %', v_minid, v_maxid;
END $$;

COMMIT;
