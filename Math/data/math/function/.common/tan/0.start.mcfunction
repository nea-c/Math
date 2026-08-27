function math:.common/sin/0.start
data modify storage math: ans set compute default math:common/input/x
data modify storage math:internal x set from storage math:internal w
function math:.common/cos/0.start
return 1
