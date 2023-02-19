# react的最小实现
#### 主要包含react-dom的整个渲染，hooks（useState），event(onclick,onchaneg)
+ react-dom的协调和commit的实现，和官网不完全一致，主要差异点有
 1. 官方的diff是顺序对比，如果key不一致/bool/undefined等就切换为map缓存遍历，通过key和index对比来获取旧的dom。本demo里面直接是顺序对比
 2. 协调的回溯阶段会标记fiber的子树是否有变更，在commit阶段判断子树没有变更就不继续迭代子树的commit了。本demo没有标记子树的变更状态，全部迭代的

+ fiber树的构建也有一点差异。官方的fiber有一个根节点fiberRoot（并不是fiber类型）和第一个fiber节点（rootFiber），但是rootFiber的type为null，tag为HostRoot，在各个环节里面也有特殊的处理（这么处理和fiber的树的结构有关，一两句话讲不清楚）。本demo的rootFiber直接当做普通fiber来处理的，所以渲染上有一些和官方不同的处理细节

#### 使用步骤
克隆仓库
`git clone https://github.com/cqxx1990/react-min.git`

进入目录，并初始化
`cd react-min`
`npm install`

运行演示demo
``npm run start``

#### 其他说明
+ 本demo没有react的实现，原因是react主要是api，具体实现也比较简单

+ react-dom在react-min/src/react-dom下，

 1. commit.js: 实现的是commit阶段
 2. defines.js：定义了几个枚举
 3. events.js：代理实现了react的事件机制，目前只配置了onClick和onChange
 4. fiber.js: 实现了fiber的定义及fiber的构建拷贝等
 5. hooks.js：hooks的基本实现，目前只实现了useState。同时react的注入直接使用的react的内部属性
 6. index.js：对应的是react-conciler下的loop文件，还包含了协调中的beginWork（向下构建子fiber）和completeWork（切换到兄弟节点和回溯到父节点的兄弟节点，同时标记fiber的更新状态）