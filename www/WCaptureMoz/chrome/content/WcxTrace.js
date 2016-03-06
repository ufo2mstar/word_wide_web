/*
	Public functions:
		WRLogMessage
		WRLogError
*/

var g_traceEnabled   = ReadRegistryTraceIsEnabled();
var g_consoleService = null;
var g_xmlSerializer  = null;


function GetConsoleServ()
{
	if (null == g_consoleService)
	{
		g_consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);;
	}
	
	return g_consoleService;
}


function GetXmlSerializer()
{
	if (null == g_xmlSerializer)
	{
		g_xmlSerializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer);
	}

	return g_xmlSerializer;
}


function NodeToStr(node)
{
	if (node)
	{
		var noChildHtml = node.cloneNode(false);
		if (noChildHtml.hasAttribute && noChildHtml.hasAttribute("style"))
		{
		    // Avoid poluting the trace with encoded base64 WR icon.
		    noChildHtml.removeAttribute("style");
		}

		var htmlOrXml = GetXmlSerializer().serializeToString(noChildHtml);
		return htmlOrXml;
	}
	else
	{
		return "null";
	}
}


function NodeToStrDeep(node)
{
	if (node)
	{
		var htmlOrXml = GetXmlSerializer().serializeToString(node);
		return htmlOrXml;
    }
    else
    {
        return "null";
    }
}


function ArgumentsToStr(args)
{
    var strToTrace = "";

    for (var i = 0; i < args.length; ++i)
    {
        var crntArg = args[i];

        if (crntArg instanceof Components.interfaces.nsIDOMNode)
        {
            strToTrace += NodeToStr(crntArg);
        }
        else
        {
            strToTrace += crntArg;
        }

        strToTrace += " ";
    }
    
    return strToTrace;
}


function WcxLogMessage()
{
    if (g_traceEnabled)
    {
        var strToTrace = "WCXExt: " + ArgumentsToStr(arguments);
	    GetConsoleServ().logStringMessage(strToTrace);
    }
}


function WcxLogError()
{
    if (g_traceEnabled)
    {
        var strToTrace = "WCXExt: " + ArgumentsToStr(arguments);
	    Components.utils.reportError(strToTrace);
    }
}


function ReadRegistryTraceIsEnabled()
{
    try
	{
        var wrk = Components.classes["@mozilla.org/windows-registry-key;1"].createInstance(Components.interfaces.nsIWindowsRegKey);
        wrk.open(wrk.ROOT_KEY_CURRENT_USER, "SOFTWARE\\Deskover\\", wrk.ACCESS_READ);

        if (wrk.hasChild("WCX"))
		{
			var subkey = wrk.openChild("WCX\\", wrk.ACCESS_READ);
			var regVal = subkey.readIntValue("WcxFFTrace");

			subkey.close();

			if (regVal == 1)
			{
				return true;
			}
			else
			{
				return false;
			}
        }
        else
		{
            return false;
        }
    }
    catch (err)
	{
        return false;
    }
}
