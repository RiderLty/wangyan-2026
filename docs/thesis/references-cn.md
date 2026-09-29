# 中文参考文献池（真实可查证，按技术栈分组，自行筛选）

> 用途：论文中文文献补充/替换池。全部来自真实检索结果（期刊官网 / 万方 / 维普 / DOI），无编造。
> 标注规则：
> - ✅链接 = 可直接点开（期刊官网 PDF / 万方 / 维普详情页）
> - 📖CNKI = 知网用篇名精确检索可下载（来自其他论文的参考文献引用，真实存在，但我没拿到直链）
> - ⚠️见链接页 = 该文真实存在且链接有效，但作者/卷期没在检索结果里，点开链接补一下
>
> 万方与知网收录基本同源：万方有链接的，知网搜篇名即可下载。

## 一、协同编辑与 CRDT（→ 1.2.2 / 2.4 / 4.4 / 5.4）

**C1** 廖斌, 何发智, 荆树旭. 实时协同工作系统中操作转换算法综述[J]. 计算机研究与发展.
✅链接：https://crad.ict.ac.cn/cn/article/pdf/preview/757.pdf （计算机研究与发展官网 PDF，作者已从 PDF 首页核实；年份卷期在链接页核对）

**C2** 廖斌, 等. 支持操作意图一致性的实时协同编辑算法综述[J]. 计算机学报, 2018.
✅链接：http://cjc.ict.ac.cn/online/onlinepaper/hfz-201847134548.pdf
梳理 OT/AST/CRDT 三类算法的一致性模型与优缺点，与论文 2.4.1 的对比论述直接呼应。

## 二、WebSocket 与实时通信（→ 2.2.3 / 4.4.1 / 5.4）

**C3** 李先懿, 郭正光. 基于Websocket的车联网报警推送系统[J]. 计算机系统应用, 2020, 29(3): 127-131.
✅链接：https://www.c-s-a.org.cn/html/2020/3/7304.html （官网全文）

**C4** ⚠️见链接页. 基于WebSocket的消息推送系统[J]. 计算机系统应用.
✅链接：https://www.c-s-a.org.cn/csa/article/abstract/5973 （摘要页需站内访问）

**C5** ⚠️见链接页. 基于有限状态机与WebSocket的投票系统[J]. 计算机系统应用, 2018, 27(2): 64-70. DOI: 10.15888/j.cnki.csa.006186
✅链接：https://www.c-s-a.org.cn/csa/article/pdf/6186
Nginx + Node.js + WebSocket 全栈实时通信，与本项目技术形态最接近的一篇。

## 三、Markdown 与编辑器（→ 1.1.2 / 2.1.3 / 5.3）

**C6** 王辰, 刘晓鑫, 曹晓燕, 王佳楠. 基于Vue.js平台的Markdown标记语言插件的研究与实现[J]. 科技风, 2018(35): 82, 85.
✅链接：https://d.wanfangdata.com.cn/periodical/Ch9QZXJpb2RpY2FsQ0hJTmV3UzIwMjUwMTE2MTYzNjE0EgxramYyMDE4MzUwNjUaCGYyc2xnOWl4 （万方）

**C7** 李维龙, 任龙. 一种融合编辑器的设计[J]. 湖南理工学院学报(自然科学版), 2022(4): 51-53.
📖CNKI：篇名精确检索。

**C8** 贺伟雄, 张江宏, 肖倩. 基于node.js的文档协作与版本化管理框架[J]. 信息技术与信息化, 2021(8): 57-61.
Markdown + Git 多人协同撰写与版本化，与论文 5.4/5.7 主题相关。
📖CNKI 或期刊知网采编平台可查。

## 四、云笔记与知识管理（→ 1.1.1 / 第 5 章背景，精选 2 篇）

**C9** 张标汉, 林宏华. 采用微服务的云笔记系统设计与实现[J]. 三明学院学报, 2024, 41(3): 67-80. DOI: 10.14098/j.cn35-1288/z.2024.03.009
✅链接：https://cjournal.hep.com.cn/1673-4343/CN/1285911062998970409

**C10** 罗秀娟. 基于云笔记Evernote的科研工作者个人知识管理探究[J]. 图书馆学研究, 2013.
✅链接：https://rc.isiniu.com/UploadFiles/e8a93f82-9e16-4e0e-9ab5-6403283970b3.pdf （知识管理背景，适配 1.1.1）

<details>（云笔记备选，之前批次已验证：马永斌/杨瑞丽《基于JAVA的云笔记系统设计与实现》新一代信息技术 2020(2)，维普 id=7101938704；贺竑睿等《基于C++跨平台的云笔记设计与实现》无线互联科技 2022(16)，维普 id=7108332082；毛静《云笔记系统的设计与实现》电子设计工程 2019 📖CNKI；贾峰《微服务框架在云笔记系统中的应用》现代计算机 2022 📖CNKI；林荣杭/刘小英《基于Flutter的云笔记系统》信息技术与信息化 2021 📖CNKI）</details>

## 五、数据库（→ 2.3.1 / 4.3）

**C11** ⚠️见链接页. 基于PostgreSQL的海量准实时数据服务平台访问方案[J]. 计算机系统应用, 2019, 28(2): 274-279. DOI: 10.15888/j.cnki.c-s-a.006775
✅链接：https://www.c-s-a.org.cn/csa/ch/reader/create_pdf.aspx?file_no=6775&flag=1&quarter_id=2&year_id=2019 （官网全文 PDF）

## 六、Node.js 后端（→ 2.2 / 5.1 / 5.2）

**C12** ⚠️见链接页. 基于Node.js与微信小程序的活动管理平台[J]. 计算机系统应用, 2019(12).
✅链接：https://www.c-s-a.org.cn/csa/article/pdf/7186 （官网全文 PDF；Node.js + Express + RESTful）

**C13** ⚠️见链接页. 基于NodeJS+Express框架的轻应用定制平台的设计与实现[J]. 计算机科学, 2017, 44(11A): 596-599. DOI: 10.11896/j.issn.1002-137X
✅链接：https://www.jsjkx.com/EN/article/openArticlePDF.jsp?id=16482 （《计算机科学》官网 PDF）

## 七、Next.js / 前端框架延伸（用户指定补充）

**C14** 刘骞. 基于next.js和nestjs技术的预算与项目管理系统的设计与实现[J]. 电脑采购, 2024(05): 13-15.
万方收录（国内刊号 11-4400/TP）；知网搜篇名可下载。
⚠️注意：本项目前端是 React + Vite，Next.js 仅作 React 同生态服务端渲染方向的参考，引用时表述为"React 元框架"相关研究即可。

## 八、React 与 Ant Design（→ 2.1.1 / 2.1.2）

**C15** 吕玉洁. 基于Ant Design的应用商店前端开发实例研究[J]. 软件, 2024(11): 160-162.
✅链接：http://d.wanfangdata.com.cn/periodical/ranj202411051 （万方）

**C16** 毛炎, 任福, 王功存, 胡欣然. 基于新型Web脚本样式框架构建城市规划编制信息平台——以ReactJS和Ant Design为例[J]. 测绘与空间地理信息, 2017(8): 81-84.
✅链接：http://m.qikan.cqvip.com/Article/ArticleDetail?id=673051888 （维普，被引 6 次）

**C17** 张根, 等. 基于React组件快速构建网站前端[J]. 电脑知识与技术, 2019.
📖CNKI：篇名精确检索（被引 11 次，真实存在）。

## 九、认证与权限（→ 4.2.2 / 4.5）

**C18** 童敏, 张黎娜, 梁伍七. 基于JWT的分布式系统认证授权机制设计和实现[J], 2022.
✅链接：https://d.wanfangdata.com.cn/periodical/Ch9QZXJpb2RpY2FsQ0hJTmV3UzIwMjUwMTE2MTYzNjE0EhFhaGp5eHh4YjIwMjIwMzAwMxoINThrcmY4eGM%3D （万方；刊名见链接页）

**C19** 卢万有. 基于JWT的RBAC在前后端分离项目中的设计与实现[J]. 电脑编程技巧与维护, 2025(1).
✅链接：https://d.wanfangdata.com.cn/periodical/dnbcjqywh202501012 （万方）

## 十、前后端分离与 Web 系统（→ 4.1.2）

**C20** 喻莹莹, 李新, 陈远平. 前后端分离的终端自适应动态表单设计[J]. 计算机系统应用, 2018(4): 70-75.
✅链接：https://www.c-s-a.org.cn/html/2018/4/6311.html （官网全文）

**C21** ⚠️见链接页（作者全名）. 基于Spring Boot的云端数据监控管理与可视化应用系统[J]. 计算机系统应用, 2020, 29(5): 123-127.
✅链接：https://www.c-s-a.org.cn/csa/article/abstract/7383

## 十一、Nginx 与部署（→ 4.1.1 / 5.9.2）

**C22** 黄晨, 柏路平. 基于Nginx-F5的双架构应用并行及流量切换方案[J]. 计算机系统应用, 2022, 31(3): 351-355.
✅链接：http://www.c-s-a.org.cn/1003-3254/8394.html （官网）

**C23** ⚠️见链接页. 基于Nginx的负载均衡技术研究与优化[J]. 计算机技术与发展, 2019, 29卷.
✅链接：http://www.xactad.net:80/oa/pdfdow.aspx?Sid=201903016 （官网全文 PDF）

## 十二、Docker 与容器化（→ 2.5 / 5.9）

**C24** 谢兆贤, 曹香美, 王超. 基于Docker容器的快速开发网页服务器[J]. 计算机系统应用, 2022, 31(4): 99-109. DOI: 10.15888/j.cnki.csa.008413
✅链接：期刊官网检索 https://www.c-s-a.org.cn/csa/article/search?jid=csa&field=en_key_word&key=docker

**C25** 詹威霖, 周宇. 基于序列挖掘的Dockerfile规则自动提取工具[J]. 计算机系统应用, 2023, 32(7): 293-298. DOI: 10.15888/j.cnki.csa.009199
✅链接：同上检索页可见。

## 十三、Redis（→ 2.3.2 / 4.2.6）

**C26** 李翀, 刘利娜, 刘学敏, 张士波. 一种高效的Redis Cluster的分布式缓存系统[J]. 计算机系统应用, 2018, 27(10): 91-98.
✅链接：https://www.c-s-a.org.cn/csa/ch/reader/create_pdf.aspx?file_no=6576&flag=1&quarter_id=10&year_id=2018 （官网全文 PDF）

## 十四、软件测试与性能测试（→ 第 6 章）

**C27** 陈建海, 陈淼, 浦云明. 基于微服务架构B/S系统的性能分析[J]. 计算机系统应用, 2020, 29(2): 233-237. DOI: 10.15888/j.cnki.csa.007285
✅链接：https://www.c-s-a.org.cn/csa/ch/reader/create_pdf.aspx?file_no=7285&flag=1&quarter_id=2&year_id=2020 （JMeter 并发压测，与 6.3 呼应）

**C28** ⚠️见链接页. 基于负载性能指标的Web测试[J]. 计算机系统应用.
✅链接：https://www.c-s-a.org.cn/csa/article/pdf/20100554 （性能指标体系：响应时间/并发用户/吞吐率）

**C29** ⚠️见链接页. 支持用例集并行测试的接口测试平台[J]. 计算机系统应用, 2023(6).
✅链接：https://www.c-s-a.org.cn/html/2023/6/8950.html （接口测试，与 6.2 呼应）

---

## 使用建议

1. **核对**：标 ⚠️ 的条目（作者/卷期没在检索结果里）点开链接补一下即可，30 秒一条；标 📖 的在知网搜篇名下载。
2. **筛选建议**（覆盖论文全部技术栈的最小集合）：
   - 协同编辑 C1/C2 + WebSocket C3/C5 + Node.js C12/C13 + PostgreSQL C11 + Redis C26 + Docker C24 + Nginx C22 + JWT C18/C19 + React/AntD C15/C16 + 前后端分离 C20 + 测试 C27 + 云笔记 C9/C10 —— 共 17 篇左右即可让中文文献占主导。
3. **替换策略**：thesis.md 现有参考文献中，CRDT[1]、OT[2][3]、REST[4]、JWT[5] 这几篇原始文献建议保留英文的（学术正统性），官方文档类（React/NestJS/Redis 等 EB/OL 条目）替换为上表中文文献。替换后同步更新正文 [n] 编号（第 1、2、6 章引用处）。
