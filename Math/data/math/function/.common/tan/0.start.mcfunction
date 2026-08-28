data modify storage math:internal y set compute default math:common/constant/tau
function math:.common/normalize_period/0.start
data modify storage math:internal w_tan_phase set from storage math:internal z
data modify storage math:internal x set from storage math:internal z
function math:.common/sin/1.evaluate
data modify storage math:internal w_tan_sin set from storage math:internal x
data modify storage math:internal x set from storage math:internal w_tan_phase
data modify storage math:internal x set compute default math:cos/00
data modify storage math:internal z set from storage math:internal x
function math:.common/sin/1.evaluate
data modify storage math:internal w_tan_cos set from storage math:internal x
return 1
