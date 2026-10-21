
from physical_fault_predictor import predict_bearing_fault

sample = {
    "max": 0.35986,
    "min": -0.41890,
    "mean": 0.017840,
    "sd": 0.122746,
    "rms": 0.124006,
    "skewness": -0.118571,
    "kurtosis": -0.042219,
    "crest": 2.901946,
    "form": 6.950855,
}

result = predict_bearing_fault(sample)
print(result)
