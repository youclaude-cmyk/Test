这是一个生成艺术系统，前端页面分为左右两个部分，左侧为控制面板，右侧为画布显示，实现点击 Generate Art 按钮，则在右侧的画布中，调用后端的qql-cli.exe进行生成（其调用的接口为32位的种子特征参数）。
- 左侧控制面板包括：Generate Art （按钮），按钮为红色，点击该按钮则调用下面的各个参数分区的参数选择特征，生成的Traits的Seed（32位token值），调用后端的qql-cli.exe进行生成艺术作品。
- Palette 特征参数区：（Palette ：Random 、Austin、Berlin、Edinburgh、Fidenza、Miami、Seattle、Seoul），（Color Mode：Simple、Stacked、Zebra），（Color Variety：Low、Medium、High）；这些特征采用下拉列表等方式进行选择实现，修改这些特征进行Traits的Seed的重新生成。
- Structure 特征参数区：（Structure : Random、Orbital、Formation、Shadows），（Direction : Random、Horizontal、Diagonal、Vertical、Random Linear、Explosive、Spiral、Circular、Random Radial），（Turbulence：None、Low、High、Random）; 这些特征采用下拉列表等方式进行选择实现，修改这些特征进行Traits的Seed的重新生成。
-  Structure 特征参数区：（Margin：None、Crisp、Wide）；这些特征采用下拉列表等方式进行选择实现，修改这些特征进行Traits的Seed的重新生成。
- Ring 特征参数区：（Ring Size：Small、Medium、Large、Random），（Size Variety：Constant、Variable、Wild、Random），（Spacing：Dense、Medium、Sparse、Random）；这些特征采用下拉列表等方式进行选择实现，修改这些特征进行Traits的Seed的重新生成。
- Rings 特征参数区：（Rings：1、3、7、All、None、Random）；（Ring Thickness：Thin、Thick、Mixed、Random）；这些特征采用下拉列表等方式进行选择实现，修改这些特征进行Traits的Seed的重新生成。
- Traits Seed 特征参数区：Seed 可编辑文本框，根据上面的这些控制面板的参数进行该Traits Seed 的生成，按照后台种子生成算法进行生成；支持 Random Seed 按钮功能，可以按照种子生成算法进行随机生成，并更新到Seed 可编辑文本框显示。
- 按S键，支持按照Seed的文件名，png格式进行生成艺术作品保存。
