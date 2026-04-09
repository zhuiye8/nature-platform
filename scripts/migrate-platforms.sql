-- ============================================================================
-- 一次性脚本：从旧系统导入 154 条注册平台数据
-- 旧数据中缺少平台名称，导入后需在系统中手动补充
-- 用法: docker exec -i nature-postgres psql -U nature -d nature < scripts/migrate-platforms.sql
-- ============================================================================

BEGIN;

INSERT INTO registration_platform (platform_name, website_url, account, password, has_ca, ca_expire_date, ca_password, contact_name, contact_phone, remark, created_by)
SELECT v.platform_name, v.website_url, v.account, v.password, v.has_ca, v.ca_expire_date::DATE, v.ca_password, v.contact_name, v.contact_phone, v.remark,
       (SELECT id FROM user_account WHERE username = 'zhangyusong')
FROM (VALUES
(NULL, 'https://ebid.gxzb.com.cn/', 'yzdzr', 'yzdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://180.76.195.209/login.html', '扬州大自然网络信息有限公司', 'yzdzr123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://scim.sinopec.com/home/#/portal', '13338851202', 'Dzr@260319', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ncfcinfo.jstcc.cn/secure-user-join', '13338851202', 'Dzr12345!', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.norincogroup-ebuy.com/', 'YZdzr123', 'YZdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://eiam.pipechina.com.cn:30007/authn/index.html?service=https%3A%2F%2Feiam.pipechina.com.cn%3A30007%2Fportal%2Fauth%2FcasLogin', '13338851202', 'YZdzr123@', FALSE, NULL, NULL, NULL, NULL, '141（国家管网）和102（国家管网数字供应链平台），已统一由该网址登录。'),
(NULL, 'http://zzcg.sz-mtr.com/', '扬州大自然网络信息有限公司', 'Dzr123456@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.fadada.com/', '13338851202', NULL, FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, '军队采购网', NULL, NULL, FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://pur.yonyoucloud.com/chinasyep', '13338851202', 'Dzr@12345', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://new.ebidding.cecep.cn/', '扬州大自然网络信息有限公司', 'YZdzr@123', FALSE, NULL, NULL, NULL, NULL, 'YZdzr@123'),
(NULL, '中银智采（中国银行）', '57525', 'tpaknL7T', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://srm.jsti.com:30001/ecs-console/index.html#/login', '15062122075', '999999', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'www.youezhao.cn/', NULL, 'YZdzr@1234', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'cgjy.tobacco.com.cn/', 'wangli1202@yc', 'YZdzr@123', FALSE, NULL, NULL, NULL, NULL, '用户名：wangli1202@yc'),
(NULL, 'https://zhsrm.trinapower.com/ierp/index.html?accountId=1433416885638004736&appNumber=srm&formId=srm_portal&userId=guest', '13338851759', '@Yznature0514', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.share-sun.com/xsapply/admin/login.aspx?unitname=nantongggzy', '15166793@qq.com', 'Dzr123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://zbb.lygyy.com.cn/home', '13338851202', 'Yzdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://www.xjygcg.com/TPBidder/memberLogin', '扬州大自然网络信息有限公司', '12345678.A', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.joccon.cn/', '91321000759680427R', 'dzr1234@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ggzy.hefei.gov.cn/pgt/005004/zjzl.html', NULL, NULL, TRUE, NULL, '123456', NULL, NULL, NULL),
(NULL, 'https://tab.wenergy.com.cn/bszn/bszn.html', '扬州大自然网络信息有限公司', 'YZdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'www.ttmall.cn', 'yzdzr', 'Yzdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://dsc.xcmg.com', 'S1333885120201', 'Yzdzr613656%', FALSE, NULL, NULL, NULL, NULL, '新'),
(NULL, 'https://zzggzy.zhengzhou.gov.cn/', '扬州大自然网络信息有限公司', 'dzr123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://srm.crrcqsyri.com:7910/', '13338851202', 'Ab123456!', FALSE, NULL, NULL, NULL, NULL, '中国中车'),
(NULL, 'https://www.crrcgo.cc/#/homePage', '2000074846', 'yzdzr123@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.youzhicai.com/', '13338851202', 'YZdzr123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://bid.zhixinzg.com/yonbip-cpu-nodesvr/h/ennenergy', '13338851202', 'YZdzr@1234', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://srm.basf-ypc.com.cn/srm/', '1059064514@qq.com', NULL, FALSE, NULL, NULL, '田焱鑫', NULL, '田焱鑫邮箱'),
(NULL, 'http://xe.hmdzzw.cn/ ', '扬州大自然网络信息有限公司', 'YZdzr202508@', FALSE, NULL, NULL, NULL, NULL, '海门区限额以下公共资源智慧交易及一体化监管平台'),
(NULL, 'https://zcpt.ct-sec.com/procure/login', 'YZDZR', 'YZdzr123*', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://yzsrm.yong-gang.cn/', '13338851202', 'Dzr123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://cg.jstcc.cn/', '15995137898', '1!Chy811017', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://app.yuncaitong.cn/#/person/index', '13338851202', 'YZdzr1234@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'www.dljczb.com', 'dzr2025', 'YZdzr1234@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://esign.sinopec.com/#/index', 'YZdzr2025', 'YZdzr1234@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.hhnycg.com/index.html#/ls/do-en?orgName=%E6%89%AC%E5%B7%9E%E5%A4%A7%E8%87%AA%E7%84%B6%E7%BD%91%E7%BB%9C%E4%BF%A1%E6%81%AF%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8&orgLicenceCode=91321000759680427R&regWay=1&regType=1&addLi=1', 'yzdazrzr', 'YZdzr20250523', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://218.2.208.150:65429', '扬州大自然网络信息有限公司', 'YZdzr1234@', TRUE, '2026-08-01', '00000000', NULL, NULL, '江苏省交通运输厅限额以下分散采购与监管系统
法人章、公章密码均为00000000（8个0）
蓝色（江苏翔晟信息）
'),
(NULL, 'https://36.129.31.29:27443/seeyon/main.do?method=main', 'GYS047', 'Zky333333', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://beps.citicsteel.com:58080/beps/login.jsp', 'L0019085', 'Yzdzr250707@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://srmzc.sgepri.sgcc.com.cn/gys-portal/index.html#', '13390619053', 'Yzdzr0702@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://zmd.zmddzsc.cn/', '91321000759680427R', '849586', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://sgccetp.com.cn/isc/newlogin.html', '91321000759680427R', '77c7kZTh#L', TRUE, '2027-01-15', '808371', NULL, NULL, 'CA用“UTC”那个，CA密码同国家电网有限公司电子商
'),
(NULL, 'http://dbba.njga.gov.cn:10002', '13338851202', 'Xx223322', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://h5.esign.cn/usercenterFront/login/web?session=224ff349-cee1-4398-882a-d1e3f16a13e0', '13338851202', 'Dzr123456!', FALSE, NULL, '123456', NULL, NULL, NULL),
(NULL, 'https://ec.ceec.net.cn/', '13338851202', 'tK2^nY2~mQ4', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://bid.js.sgcc.com.cn/tyzb/tyzb2.0/fwdt/index.html#/login', '13338851202', 'Dzr@20250618', TRUE, '2027-01-15', '808371', NULL, NULL, 'CA用“UTC”那个，CA密码同国家电网有限公司电子商'),
(NULL, 'https://pcms.suzhoubank.com/szcgpt/', '91321000759680427R', 'nongyu67298?', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://snjcsup.shenergy.net.cn/shenergyPortal/', 'yznature123', 'Yznature123!', FALSE, NULL, NULL, NULL, NULL, '登录的同时需要插上E签宝的CA'),
(NULL, 'https://srm.windeyenergy.com/', '3000014075', 'Windey@2025', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://cg.11185.cn/', 'YZdaziran', 'uiop#ASDF11', FALSE, NULL, NULL, '13338851202', NULL, NULL),
(NULL, 'http://inquiry.camsnetec.com:89/wui/index.html#/?logintype=2', 'U00739', 'YZdzr250604', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www2.cnpcbidding.com/#/wel/index', 'yzdzr250527', 'YZdzr250528@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.eavic.com/rest/index', 'yz_dzr19990712', 'YZdzr250527@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ebidmanage.cnpcbidding.com/bidder/ebid/base/login.html', 'yzdzr250527', 'YZdzr250527@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://iscmdzzb.pipechina.com.cn:8081/web-login/index.html#/login', '13338851202', 'YZdzr0527@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://sso.ahzwfw.gov.cn/uccp-server/login?appCode=55bee510abb44301805c29cba9851c1b', 'ohwmrfyyl', 'YZdzr20250523', FALSE, NULL, NULL, '谢宝建', '13338851759', '选“法人用户”登录'),
(NULL, NULL, '91321000759680427R', 'a^57@ujF#kk', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://221.226.74.198:9090/login', 'S00010449', 'YZdzr1234#', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ygcg.tzjtcyjt.com/fore/home/#/', '15195276299', 'YZdzr12345@YZdzr12', FALSE, '2026-05-20', '12345678', NULL, NULL, NULL),
(NULL, 'https://hysrm.hanyun', '13338851202', 'YZdzr250519@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://www.ezczb.com', '扬州大自然网络信息有限公司', 'YZdzr250519@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://srm.iwhalecloud.com/spa/custom/static/index.html#/main/cs/app/6a5f32e53508414e98167de900834815_SingleEditE9NewLogin?_key=d74kin', 'dzr2025513', 'YZdzr250513@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://cgpt.njglyy.com:6443/home', '13338851202', 'YZdzr250506@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.ecpgsc.com/#/homePage/home', '91321000759680427R', 'f^5@1@DKP#hy', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ztb.njucm.edu.cn/login/login-pub.jsf?loginType=seller', 'yzdzr0506', 'YZdzr250506@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://wadbkq.njga.gov.cn/login?redirect=%2Fhome', 'YZDZR123', NULL, FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://srm.changan-mazda.com.cn:8020/', '22080937', 'DZR2024@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://hnsggzyjy.henan.gov.cn/', '扬州大自然网络信息有限公司', 'YZdzr250422', TRUE, '2026-04-23', '111111', NULL, NULL, '两个CA，一个公司名称CA，一个法人CA，法人CA无法登录。'),
(NULL, 'https://cg.95306.cn/index', 'YZdzr250417', 'YZdzr87590132@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://zbcg.jstxry.com', '扬州大自然网络信息有限公司', 'Dzr@12345', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://dzzb.ciesco.com.cn/', '扬州大自然2025年', 'YZdzr250401@', TRUE, '2026-04-02', '123456', NULL, NULL, '两个CA，一个公司名称CA，一个法人CA，法人CA无法登录。'),
(NULL, 'https://zbcg.tzdig.cn/', '13338851202', 'Dzr2025.', TRUE, '2026-03-28', '123456', NULL, NULL, NULL),
(NULL, 'https://www.ronghw.cn/', 'YZdzr25325', 'YZdzr@250325', TRUE, '2026-04-01', '92377211', '王莉', '13338851202', '项目投标选择“李旭”账号
账号：YZdzr250403
密码：YZdzr250403@'),
(NULL, 'https://ep.chi-coscoshipping.com:8001/', 'DZR123', 'Dzr123！@#', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://eps.fhzz.com.cn/', 'yzdzr123', 'YZdzr123', FALSE, NULL, NULL, NULL, NULL, '商务联系人：谢宝建'),
(NULL, 'https://jsdzbh.com/login', '扬州大自然网络信息有限公司', 'YZdzr1234#', FALSE, NULL, NULL, NULL, NULL, '可用于江苏省政府采购网、苏采云项目的电子保函申请'),
(NULL, 'http://183.134.62.137:7774/#/supplier-portal/notice', NULL, 'Dzr123123.', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://etp.faw.cn/', 'YZDZRWL', 'YZDZRWL', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://hgcg.hghngroup.com/web-login/index.html#/login', '15150805875', 'Yzdzr.20241031', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.wxcq.com.cn:9142/TPBidder/memberLogin', NULL, NULL, FALSE, NULL, NULL, NULL, NULL, '江苏乐思：
登录名：江苏乐思信安技术有限公司
密码：JSlsxa041205
CA密码：654123'),
(NULL, 'https://fwgs.sinograin.com.cn/portal', 'Yzdzr123', 'Yzdzr123456@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://218.3.161.98:28001 ', 'DZR1234', 'DZR123456@ssw0rd', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://58.212.207.240:8008/Application/CUVENDOR', 'daziran', 'z7YM$bBc', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.e-casic.com/', 'YZDZRWLXX', 'YZdzr123@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://www.cdt-ec.com', 'lz12345678', 'YZdzr12345@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, '手机APP', NULL, NULL, FALSE, NULL, NULL, NULL, NULL, '应用口令：yzdzr'),
(NULL, 'https://logo.ibuy.ccb.com/member/login/executeLogin.htm?isInlineUser=1&no_sitemesh', NULL, 'DZR123456@ssw0rd', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://vpn.jsph.org.cn:14433', NULL, NULL, FALSE, NULL, NULL, NULL, NULL, '第一步：江苏省人民医院VPN账户https://vpn.jsph.org.cn:14433
账号：13338851202
密码：dzr123456@
第二步：江苏省人民医院供应商服务平台http://172.16.4.79:8066/tender/dzcg/toLogin
13338851202，123456789'),
(NULL, 'https://js.fwgov.cn', 'yzdzr20230821', NULL, FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ebidding.sinopec.com/v3/portal/#/', 'YZDZR', 'YZxytd@ztb169', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ecp.sgcc.com.cn/ecp2.0/portal/#/', '91321000759680427R', 'T*5862441', TRUE, '2027-01-15', '808371', NULL, NULL, 'CA（UTC那个）密码：808371'),
(NULL, 'https://zb.sec.com.cn/', 'YZDZR1234 ', 'YZdzr1234#', TRUE, NULL, '12345678', NULL, NULL, NULL),
(NULL, 'https://bid.powerchina.cn/Contractor', '扬州大自然网络信息有限公司', 'DZr@1234567', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://iscm.pipechina.com.cn:8443/home/', 'yzdzr20230402', 'DZr@12345678', FALSE, NULL, NULL, NULL, NULL, '账号密码对应：国家供应链认证机构（信用认证
手机号：13338851202
密码：YZdzr123）
'),
(NULL, 'zcpt.cebenvironment.com.cn', 'gys_123z', 'Dzr240319.', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, ' http://srm.zt.net.cn/login1', '91321000759680427R', 'YZdzr123@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'www.ispacechina.com', 'DZR123456', 'Dzr@2026323', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ecp.capitalwater.cn/ ', 'DZR123456', 'Dzr123456789', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://ego.chinacoal.com/#/', 'yzdzr1999712', 'DZr@19997120704', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://bid.xkjt.net/bid_ol/home/index.do', 'yzdzr1999712', 'DZr@123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://221.6.38.162:8081/portal?index=0', '扬州大自然网络信息有限公司', 'YZnature123!', FALSE, NULL, NULL, NULL, NULL, '翔晟电子签章：
系统登录名：15166793@qq.com
密码：YZdzr19990712
应用口令：dzr990712'),
(NULL, 'http://jszfcg.jsczt.cn/jszc/workbench/supplier', '13338851202', 'YZdzr1234#', TRUE, '2026-10-13', '111111', NULL, NULL, NULL),
(NULL, 'ztb.jlwater.com:8008/ztbweb/', 'W91321000759680427R', 'Yz@123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://ecg.portjs.cn:20909/#/portal?index=0', '扬州大自然网络信息有限公司', 'DZr@123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.neep.shop/', 'wodecuo', 'DZr@123456\-@', FALSE, NULL, NULL, NULL, NULL, '账号：xbj20240521

大自然国能E招平台账号：
13338851759'),
(NULL, 'http://chnenergybidding.cedex.cn', 'yzdzr1999712', 'DZr@123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'www.chnenergybidding.com.cn', 'yzdzr1997712', 'YZdzr@7@1@2', TRUE, NULL, 'yzdzr123', NULL, NULL, '大自然CA：
账号：YZDZR123
密码：yzdzr123
'),
(NULL, 'http://www.choicelink.cn/', 'yzdzr', 'yzdzr2020', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://dhztb.jinzhaocai.com/main', 'yznature', 'dzr123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://cg.czrbzb.com/cg/reg.php', 'YZDZR2023', 'YZDZR2023', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://xcg-nginx.paas.cmbchina.com/seller/#/login?redirect=%2Fdashboard', 'yznature', 'DZr@123456', TRUE, '2026-12-17', 'dzr123', NULL, NULL, '主账户
账号：91321000759680427R
密码：Dzr@20260306'),
(NULL, 'https://www.cnncecp.com/', '91321000759680427R', 'Dzr@250530', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://srm.sac-china.com/', 'V16120161', 'yzdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ebidding.sinopec.com/TPWeb4AAA/', 'yzdzr', 'yzdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://ebid.espic.com.cn/', 'YZDZR123', 'Gnez202625@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://proc-bidding.jd.com/home', 'yzdzr-2023', 'yzdzr123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.szecp.com.cn/（https://szecp.crc.com.cn）', '扬州大自然网络信息有限公司', 'DZRdzr147', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.ccgp-jiangsu.gov.cn:5009/zfcgzx/login?bs=5', 'YZDZR123', 'DZRdzr147', TRUE, NULL, '123456', NULL, NULL, NULL),
(NULL, 'https://www.crscec.com/biddingManager/', 'yznature', 'YZdzr1234@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://zfcg.nantong.gov.cn/', NULL, NULL, TRUE, '2025-11-30', '123456', NULL, NULL, '掌易捷APP账号：9mesz5qt
掌易捷APP密码：NTjy1234
标证通APP账号：13338851202
标证通APP密码：YZdzr4321'),
(NULL, 'https://jszb.chinaccsscm.cn/ztf/Index.jsp', '91321000759680427R', 'YZdzr@dzr25', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, NULL, '13338851202', 'YZdzr1234', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://bid.easternairports.com:1443/', '91321000759680427R', 'dzr12345', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://supplier.tongwei.com/', '13338851759', 'de3sp9', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'scs.inspur.com', 'yznature', 'YZdzr87590132@', FALSE, NULL, 'yznature', NULL, NULL, NULL),
(NULL, 'http://xdsc.xcmg.com:8985/#/', 'yzdzr1234', 'B613656%', FALSE, NULL, NULL, NULL, NULL, '旧系统 不用'),
(NULL, 'e.sinochemitc.com', 'yzdzr1234', 'YZdzr87590375', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.sxtba.com/home', 'yzdzr321', 'YZdzr123@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.isccc.gov.cn/index.shtml', 'yzdzr2021', '2021@YZdzr', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.cecbid.org.cn/auth/login', 'yzdzrNature', 'yzdzr@1234', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://b2b.10086.cn/b2b/main/preIndex.html', 'B2B-KINGXIN@HQ.CMCC', 'DZr@2022', FALSE, NULL, NULL, '王莉', NULL, NULL),
(NULL, 'http://cg.czzhzb.com/', 'YZDZR2021', 'YZDZR2021', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://www.365trade.com.cn/', '13338851202', 'YZdzr1234@', TRUE, NULL, '19990712', NULL, NULL, NULL),
(NULL, 'http://www.dyjyzbw.cn:90/wui/index.html#/?logintype=1&_key=n8o75w       http://www.dyjyzbw.cn/', '扬州大自然网络信息有限公司', 'yz_Nature', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://www.infobidding.com/index.html', 'yzdzr123', 'YZdzr1234@', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://eps.ctg.com.cn/', '13338851759', 'YZdzr1234@', TRUE, NULL, 'YZdzr1234@4321', NULL, NULL, NULL),
(NULL, 'https://www.easyjcx.com/#/index', 'yzdzr1234', 'yzdzr4321@', FALSE, NULL, '123456', '王莉', '13338851202', NULL),
(NULL, 'https://caigou.chinatelecom.com.cn/ctsc-portal/ctscPortal?redirect=%2FHomePage', '1230494', 'YZdzr1234@', FALSE, '2026-09-25', '12345678', NULL, NULL, NULL),
(NULL, 'https://zbcg.jchc.cn/login?ty=3', '扬州大自然网络信息有限公司', 'YZdzr1234@', FALSE, NULL, 'yokl35214', NULL, NULL, NULL),
(NULL, 'http://zc.xstzgs.com:18380/', '扬州大自然网络信息有限公司', 'yzdzr1234', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://buy.cnooc.com.cn/cbjyweb/', 's_yzdzrwl', '5$gyxO1N', FALSE, NULL, NULL, NULL, NULL, '原来（不用）
用户名：s_yzdzr1997， 
密码：YZdzr123'),
(NULL, 'www.ejy365.com', '扬州大自然网络信息有限公司', ' YZdzr1234', TRUE, '2026-07-17', '123456', NULL, NULL, NULL),
(NULL, 'https://papms.pa18.com', 'FXXX20200909', 'dzr123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://ec.chng.com.cn/ecmall/', 'yzdzr123', 'Yzdzr@1233211', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.chdtp.com/', 'dzr1234', 'yzdzr66876', FALSE, NULL, NULL, '蔡海勇', '15995137898', NULL),
(NULL, 'http://www.cuecp.cn/portal/index.jhtml', 'ex-yangfan378', 'YZDZr.1362', FALSE, NULL, '36Y@Bj*x', NULL, NULL, NULL),
(NULL, 'http://www.jicaibao.com', 'yzdzr', 'Yzdzr@123', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://www.jstcc.cn/', 'chy811017', NULL, FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'nj.jfh.com', '15062807437', '0905luyb', TRUE, NULL, 'dzr123', NULL, NULL, NULL),
(NULL, 'http://www.czctzb.com/login.html', '扬州大自然网络公司', '6661610@dd', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'http://180.101.238.212:8280/hodeframe2018_cxda/login.action?page=1', '13004313133', 'dzr123456', FALSE, NULL, NULL, NULL, NULL, NULL),
(NULL, 'https://c.cnbm.com.cn/cnbm-portal-view/#/login', '13338851202', 'YZdzr123', FALSE, NULL, NULL, '王莉', '13338851202', NULL)
) AS v(platform_name, website_url, account, password, has_ca, ca_expire_date, ca_password, contact_name, contact_phone, remark);

SELECT count(*) AS imported FROM registration_platform;

COMMIT;
